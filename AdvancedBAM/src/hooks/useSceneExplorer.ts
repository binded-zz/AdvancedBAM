import { isSceneExplorerInstalled$ } from '../core/bindings';
import apiSafe from '../core/apiSafe';

/**
 * Provides access to the SceneExplorer soft dependency.
 *
 * - `isInstalled`: true only when SceneExplorer is loaded in the game session.
 *   The C# backend detects it via AppDomain reflection at startup and publishes
 *   the result as the `isSceneExplorerInstalled` ValueBinding.
 * - `openEntity`: sends the entityKey string to the C# trigger, which calls
 *   SceneExplorer to inspect/select that entity via reflection. No-ops if not installed or key is empty.
 */
export const useSceneExplorer = () => {
  const isInstalled = apiSafe.useValue<boolean>(isSceneExplorerInstalled$, false) ?? false;

  const openEntity = (entityKey: string) => {
    if (!entityKey) return;
    try {
      apiSafe.openInSceneExplorer(entityKey);
    } catch {
      // Silently ignore — never let SceneExplorer failures affect AdvancedBAM UI
    }
  };

  return { isInstalled, openEntity };
};

export default useSceneExplorer;
