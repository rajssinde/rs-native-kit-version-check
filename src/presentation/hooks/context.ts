import { createContext } from 'react';
import type { IVersionManagerCore } from '../../domain/IVersionManagerCore';

export const VersionManagerContext = createContext<IVersionManagerCore | null>(
  null
);
