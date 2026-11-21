import { VaultLike } from './types';
import { joinVaultPath, normalizeFolder } from './paths';

export function generateDashboardContent(contentFolder: string = 'content'): string {
  const cleanFolder = normalizeFolder(contentFolder);

  return `# Content Production Dashboard

\`\`\`dataview
TABLE 
  publish_date as "Publish Date",
  status as "Status",
  series_id as "Series",
  slop_score as "Slop Score"
FROM "${cleanFolder}"
WHERE file.name != "_pipeline" AND file.name != "_dashboard"
SORT publish_date ASC
\`\`\`
`;
}

export async function createDashboardNote(
  vault: VaultLike,
  contentFolder: string = 'content'
): Promise<string> {
  const cleanFolder = normalizeFolder(contentFolder);
  const dashboardPath = joinVaultPath(cleanFolder, '_dashboard.md');

  if (cleanFolder && !(await vault.exists(cleanFolder))) {
    await vault.createFolder(cleanFolder);
  }

  const content = generateDashboardContent(cleanFolder);
  await vault.write(dashboardPath, content);
  return dashboardPath;
}
