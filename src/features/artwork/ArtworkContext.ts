import { createContext } from 'react';
import type { ArtworkResources } from '../../lib/artwork-resources';
export const ArtworkContext = createContext<ArtworkResources | null>(null);
