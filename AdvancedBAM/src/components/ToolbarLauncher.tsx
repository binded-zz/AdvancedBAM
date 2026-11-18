import React from 'react';
import { useLocalization } from 'cs2/l10n';
import apiSafe, { safeUseValue } from '../core/apiSafe';
import { windowVisible$, launcherVisible$ } from '../core/bindings';
import './ToolbarLauncher.css';

export const ToolbarLauncher: React.FC = () => {
  const { translate } = useLocalization();
  const visible = safeUseValue<boolean>(windowVisible$, false);
  const showLauncher = safeUseValue<boolean>(launcherVisible$, true);

  if (!showLauncher) return null;

  const tooltip = translate('AdvancedBAM.ToolbarTooltip', 'Advanced Building & Asset Manager (BAM)') ?? 'Advanced Building & Asset Manager (BAM)';

  return (
    <div className="bam-toolbar-wrapper">
      <button
        className={`bam-toolbar-btn${visible ? ' active' : ''}`}
        onClick={() => apiSafe.toggleWindow()}
        title={tooltip}
      >
        <svg className="bam-toolbar-icon" viewBox="0 0 24 24" fill="#4fc3f7">
          {/* Stylized Modern Building & Asset Icon */}
          <path d="M19 2H9c-1.1 0-2 .9-2 2v2H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM5 20V8h2v12H5zm6 0H9V4h10v16h-8zm2-14h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm4-8h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" fill="#4fc3f7" />
        </svg>
      </button>
    </div>
  );
};

export default ToolbarLauncher;
