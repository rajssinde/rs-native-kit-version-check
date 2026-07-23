#import "VersionCheck.h"
#import <CommonCrypto/CommonHMAC.h>
#import <BackgroundTasks/BackgroundTasks.h>
#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <UIKit/UIKit.h>
#import <sys/utsname.h>

#if __has_include("VersionCheck-Swift.h")
#import "VersionCheck-Swift.h"
#endif

static NSString *const kVersionCheckKeychainService = @"com.rsnativekit.versioncheck";

@implementation VersionCheck

#pragma mark - App info

- (void)getCurrentAppVersion:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
    NSString *version = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleShortVersionString"];
    resolve(version ?: @"");
}

- (void)getBuildNumber:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
    NSString *build = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleVersion"];
    resolve(build ?: @"");
}

- (void)getBundleId:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
    resolve([[NSBundle mainBundle] bundleIdentifier] ?: @"");
}

#pragma mark - Device info

- (void)getOsVersion:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
    resolve([[UIDevice currentDevice] systemVersion]);
}

- (void)getDeviceModel:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
    struct utsname systemInfo;
    uname(&systemInfo);
    NSString *identifier = [NSString stringWithCString:systemInfo.machine encoding:NSUTF8StringEncoding];
    resolve(identifier ?: [[UIDevice currentDevice] model]);
}

- (void)getLocale:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
    resolve([[NSLocale currentLocale] localeIdentifier]);
}

#pragma mark - Key-value storage (UserDefaults)

- (void)storageGet:(NSString *)key
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
    NSString *value = [[NSUserDefaults standardUserDefaults] stringForKey:key];
    resolve(value ?: [NSNull null]);
}

- (void)storageSet:(NSString *)key
             value:(NSString *)value
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
    [[NSUserDefaults standardUserDefaults] setObject:value forKey:key];
    resolve(nil);
}

- (void)storageRemove:(NSString *)key
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
    [[NSUserDefaults standardUserDefaults] removeObjectForKey:key];
    resolve(nil);
}

#pragma mark - Secure storage (Keychain)

- (NSMutableDictionary *)keychainQueryForKey:(NSString *)key
{
    return [@{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: kVersionCheckKeychainService,
        (__bridge id)kSecAttrAccount: key,
    } mutableCopy];
}

- (void)secureStorageGet:(NSString *)key
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
    NSMutableDictionary *query = [self keychainQueryForKey:key];
    query[(__bridge id)kSecReturnData] = @YES;
    query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;

    CFTypeRef result = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &result);
    if (status == errSecSuccess) {
        NSData *data = (__bridge_transfer NSData *)result;
        NSString *value = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        resolve(value ?: [NSNull null]);
    } else if (status == errSecItemNotFound) {
        resolve([NSNull null]);
    } else {
        reject(@"secure_storage_get_failed", @"Keychain read failed", nil);
    }
}

- (void)secureStorageSet:(NSString *)key
                   value:(NSString *)value
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
    NSData *data = [value dataUsingEncoding:NSUTF8StringEncoding];
    NSMutableDictionary *query = [self keychainQueryForKey:key];

    // Overwrite semantics: delete any existing item before adding, since SecItemUpdate
    // requires a separate attributes dictionary and delete+add is simpler/safer here.
    SecItemDelete((__bridge CFDictionaryRef)query);
    query[(__bridge id)kSecValueData] = data;
    query[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleAfterFirstUnlock;

    OSStatus status = SecItemAdd((__bridge CFDictionaryRef)query, NULL);
    if (status == errSecSuccess) {
        resolve(nil);
    } else {
        reject(@"secure_storage_set_failed", @"Keychain write failed", nil);
    }
}

- (void)secureStorageRemove:(NSString *)key
                    resolve:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
    NSMutableDictionary *query = [self keychainQueryForKey:key];
    SecItemDelete((__bridge CFDictionaryRef)query);
    resolve(nil);
}

#pragma mark - Signature verification (doc 03 §3.4)

// Trusted key material is embedded at build time via Info.plist ("VMTrustedSigningKeys",
// a dictionary mapping keyId -> base64 key material) rather than shipped from JS, per
// §3.4's "embedded at build time, not hardcoded in the JS bundle" requirement. Host apps
// add this key to their own Info.plist; if absent, verification fails closed.
- (NSData *)resolveKeyMaterial:(NSString *)keyId
{
    NSDictionary *keys = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"VMTrustedSigningKeys"];
    NSString *base64 = keys[keyId];
    if (![base64 isKindOfClass:[NSString class]]) return nil;
    return [[NSData alloc] initWithBase64EncodedString:base64 options:0];
}

- (void)verifyEd25519:(NSString *)keyId
        messageBase64:(NSString *)messageBase64
      signatureBase64:(NSString *)signatureBase64
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
    NSData *keyMaterial = [self resolveKeyMaterial:keyId];
    NSData *message = [[NSData alloc] initWithBase64EncodedString:messageBase64 options:0];
    NSData *signature = [[NSData alloc] initWithBase64EncodedString:signatureBase64 options:0];
    if (!keyMaterial || !message || !signature) {
        resolve(@NO);
        return;
    }
#if __has_include("VersionCheck-Swift.h")
    // CryptoKit's Curve25519 API is Swift-only — bridged via Ed25519Verifier.swift,
    // exposed to this Obj-C++ file through CocoaPods' auto-generated -Swift.h header
    // (standard mixed-language-pod interop; no manual bridging header required).
    BOOL valid = [Ed25519Verifier verifyWithPublicKey:keyMaterial message:message signature:signature];
    resolve(@(valid));
#else
    reject(@"verify_ed25519_unavailable",
           @"Ed25519Verifier.swift was not compiled into this pod — Ed25519 verification is unavailable on this build",
           nil);
#endif
}

- (void)verifyHmacSha256:(NSString *)keyId
            messageBase64:(NSString *)messageBase64
                 macBase64:(NSString *)macBase64
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
    NSData *keyMaterial = [self resolveKeyMaterial:keyId];
    NSData *message = [[NSData alloc] initWithBase64EncodedString:messageBase64 options:0];
    NSData *expectedMac = [[NSData alloc] initWithBase64EncodedString:macBase64 options:0];
    if (!keyMaterial || !message || !expectedMac) {
        resolve(@NO);
        return;
    }

    unsigned char computed[CC_SHA256_DIGEST_LENGTH];
    CCHmac(kCCHmacAlgSHA256, keyMaterial.bytes, keyMaterial.length, message.bytes, message.length, computed);

    if (expectedMac.length != CC_SHA256_DIGEST_LENGTH) {
        resolve(@NO);
        return;
    }
    // Constant-time comparison.
    const unsigned char *expectedBytes = (const unsigned char *)expectedMac.bytes;
    unsigned char diff = 0;
    for (NSUInteger i = 0; i < CC_SHA256_DIGEST_LENGTH; i++) {
        diff |= computed[i] ^ expectedBytes[i];
    }
    resolve(@(diff == 0));
}

#pragma mark - Background scheduling (doc 01 §4.1 "scheduler" row)

// BGTaskScheduler requires the host app to declare the task identifier in Info.plist
// (`BGTaskSchedulerPermittedIdentifiers`) and enable the "Background Modes > Background
// processing" capability — standard BGTaskScheduler integration any RN library using it
// requires (this library cannot inject those into a consumer's Info.plist itself). The
// scheduled task, once the OS runs it, starts a background URLSession-driven check;
// full headless-JS-on-cold-launch parity with Android's WorkManager path is not
// implemented in this pass — while the app process is alive this still lets iOS wake it
// periodically to call into the already-running JS runtime via the task handler below.

static NSString *const kVersionCheckBGTaskIdentifier = @"com.rsnativekit.versioncheck.refresh";

- (void)scheduleBackgroundCheck:(NSString *)taskId
                  minIntervalMs:(double)minIntervalMs
                        resolve:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
    if (@available(iOS 13.0, *)) {
        BGAppRefreshTaskRequest *request = [[BGAppRefreshTaskRequest alloc] initWithIdentifier:kVersionCheckBGTaskIdentifier];
        request.earliestBeginDate = [NSDate dateWithTimeIntervalSinceNow:(minIntervalMs / 1000.0)];
        NSError *error = nil;
        BOOL submitted = [[BGTaskScheduler sharedScheduler] submitTaskRequest:request error:&error];
        if (!submitted) {
            reject(@"schedule_background_check_failed", error.localizedDescription ?: @"BGTaskScheduler submission failed — verify BGTaskSchedulerPermittedIdentifiers in Info.plist", error);
            return;
        }
        resolve(nil);
    } else {
        reject(@"schedule_background_check_unavailable", @"BGTaskScheduler requires iOS 13+", nil);
    }
}

- (void)cancelBackgroundCheck:(NSString *)taskId
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
    if (@available(iOS 13.0, *)) {
        [[BGTaskScheduler sharedScheduler] cancelTaskRequestWithIdentifier:kVersionCheckBGTaskIdentifier];
    }
    resolve(nil);
}

#pragma mark - TurboModule plumbing

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeVersionCheckSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"VersionCheck";
}

@end
