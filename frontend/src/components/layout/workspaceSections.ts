export type WorkspaceTab = 'presets' | 'parameters' | 'describe' | 'report'

/** What the Report tab wants to say while another tab is open. */
export interface ReportIndicator {
  tone: 'valid' | 'warn' | 'invalid'
  /** Spoken to a screen reader, since the dot itself is only colour. */
  label: string
}

export const WORKSPACE_TABS: readonly { id: WorkspaceTab; label: string }[] = [
  { id: 'presets', label: 'Presets' },
  { id: 'parameters', label: 'Parameters' },
  { id: 'describe', label: 'Describe' },
  { id: 'report', label: 'Report' },
]

export const workspaceTabId = (tab: WorkspaceTab) => `workspace-tab-${tab}`
export const workspacePanelId = (tab: WorkspaceTab) => `workspace-panel-${tab}`
