import { Angle, AngleType, AntiSlopStrictness, SeriesArchetype, SeriesPlan } from './types';
import { lintScriptForSlop } from './anti_slop';
import { buildAnglePrompt, buildSeriesPrompt } from './prompts';
import { formatDate } from './dates';
import { createAngleNote } from './actions';
import { writeSeriesAtomic } from './series';
import { NodeFsVault } from './node-fs-vault';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const MITOS_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'mitos_brainstorm_angles',
    description: 'Generate 3 anti-slop short-form technical video angles from a topic with concrete visual anchors and hook budgets.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Technical topic, feature, bug, or concept to brainstorm',
        },
        context: {
          type: 'string',
          description: 'Optional code snippet or active note context',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'mitos_plan_series',
    description: 'Architect a 3-part interconnected short-form video series arc with closed link integrity and narrative throughline.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Technical topic for the series',
        },
        archetype: {
          type: 'string',
          enum: ['3_act_engineering_problem', 'deep_dive_breakdown', 'versus_comparison'],
          description: 'Narrative blueprint archetype',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'mitos_lint_script',
    description: 'Lint a spoken script or hook for banned AI buzzwords, verbose openings, and verifiable proof anchors.',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'Spoken script or draft note to inspect',
        },
        strictness: {
          type: 'string',
          enum: ['lenient', 'standard', 'ruthless'],
          description: 'Slop detection strictness level',
        },
      },
      required: ['script'],
    },
  },
  {
    name: 'mitos_save_angle_note',
    description: 'Persist a generated short-form technical angle note directly to the Obsidian vault filesystem and update the Kanban pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultPath: {
          type: 'string',
          description: 'Absolute path to the Obsidian vault root. Falls back to MITOS_VAULT_PATH environment variable or current working directory.',
        },
        contentFolder: {
          type: 'string',
          description: 'Relative folder inside the vault for content notes (default: "content").',
        },
        title: {
          type: 'string',
          description: 'Title of the angle note.',
        },
        hook: {
          type: 'string',
          description: 'Opening spoken hook (0-3s).',
        },
        angleType: {
          type: 'string',
          enum: ['pain_point', 'contrarian', 'teardown'],
          description: 'Narrative angle type archetype.',
        },
        coreTension: {
          type: 'string',
          description: 'Core tension, engineering gotcha, or problem.',
        },
        visualProofAnchor: {
          type: 'string',
          description: 'Visual evidence anchor (terminal log, benchmark metric, code diff).',
        },
        scriptDraft: {
          type: 'string',
          description: 'Optional full 35s spoken draft script.',
        },
        openLoop: {
          type: 'string',
          description: 'Optional forward connection, cliffhanger, or next step.',
        },
        publishDate: {
          type: 'string',
          description: 'Target publish date in YYYY-MM-DD format (default: today).',
        },
      },
      required: ['title', 'hook', 'angleType', 'coreTension', 'visualProofAnchor'],
    },
  },
  {
    name: 'mitos_save_series',
    description: 'Persist a multi-part series plan directly to the Obsidian vault with atomic multi-note links and update the Kanban pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        vaultPath: {
          type: 'string',
          description: 'Absolute path to the Obsidian vault root. Falls back to MITOS_VAULT_PATH environment variable or current working directory.',
        },
        contentFolder: {
          type: 'string',
          description: 'Relative folder inside the vault for content notes (default: "content").',
        },
        series: {
          type: 'object',
          description: 'Validated SeriesPlan object containing series_title, premise, archetype, and episodes.',
        },
        startDate: {
          type: 'string',
          description: 'Optional start publish date in YYYY-MM-DD format (default: tomorrow).',
        },
        cadenceDays: {
          type: 'number',
          description: 'Publish cadence in days between episodes (default: 2).',
        },
      },
      required: ['series'],
    },
  },
];

export async function handleMcpToolCall(
  name: string,
  args: Record<string, any>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    switch (name) {
      case 'mitos_lint_script': {
        const text = String(args.script || '');
        const strictness = (args.strictness as AntiSlopStrictness) || 'standard';
        const result = lintScriptForSlop(text, strictness);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'mitos_brainstorm_angles': {
        const topic = String(args.topic || '');
        const context = args.context ? String(args.context) : undefined;
        const prompt = buildAnglePrompt(topic, context);
        return {
          content: [
            {
              type: 'text',
              text: prompt,
            },
          ],
        };
      }

      case 'mitos_plan_series': {
        const topic = String(args.topic || '');
        const archetype = (args.archetype as SeriesArchetype) || '3_act_engineering_problem';
        const prompt = buildSeriesPrompt(topic, archetype, 3);
        return {
          content: [
            {
              type: 'text',
              text: prompt,
            },
          ],
        };
      }

      case 'mitos_save_angle_note': {
        const title = args.title ? String(args.title).trim() : '';
        const hook = args.hook ? String(args.hook).trim() : '';
        const angleType = args.angleType as AngleType;
        const coreTension = args.coreTension ? String(args.coreTension).trim() : '';
        const visualProofAnchor = args.visualProofAnchor ? String(args.visualProofAnchor).trim() : '';
        const scriptDraft = args.scriptDraft !== undefined ? String(args.scriptDraft) : undefined;
        const openLoop = args.openLoop ? String(args.openLoop).trim() : '';

        if (!title) throw new Error('Missing required parameter: title');
        if (!hook) throw new Error('Missing required parameter: hook');
        if (!angleType || !['pain_point', 'contrarian', 'teardown'].includes(angleType)) {
          throw new Error('Invalid or missing angleType. Must be one of: pain_point, contrarian, teardown');
        }
        if (!coreTension) throw new Error('Missing required parameter: coreTension');
        if (!visualProofAnchor) throw new Error('Missing required parameter: visualProofAnchor');

        const vaultPath = args.vaultPath || process.env.MITOS_VAULT_PATH || process.cwd();
        const contentFolder = args.contentFolder !== undefined ? String(args.contentFolder) : 'content';
        const publishDate = args.publishDate ? String(args.publishDate).trim() : formatDate(new Date());

        // Automatically lint the script / hook using lintScriptForSlop
        const textToLint = scriptDraft && scriptDraft.trim() ? scriptDraft : hook;
        const lintResult = lintScriptForSlop(textToLint, 'standard', hook);

        const angle: Angle = {
          id: `angle-${Date.now()}`,
          angleType,
          title,
          hook,
          coreTension,
          visualProofAnchor,
          openLoop,
          lint: lintResult,
        };

        const vault = new NodeFsVault(vaultPath);
        const saved = await createAngleNote(vault, contentFolder, angle, publishDate, {
          status: 'planned',
          kanbanLane: 'ideas',
          scriptDraft,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  path: saved.path,
                  basename: saved.basename,
                  status: saved.status || 'planned',
                  slopScore: lintResult.score,
                  kanbanLane: 'Ideas',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'mitos_save_series': {
        if (!args.series || typeof args.series !== 'object') {
          throw new Error('Missing required parameter: series');
        }
        const vaultPath = args.vaultPath || process.env.MITOS_VAULT_PATH || process.cwd();
        const contentFolder = args.contentFolder !== undefined ? String(args.contentFolder) : 'content';
        const vault = new NodeFsVault(vaultPath);
        const result = await writeSeriesAtomic(
          vault,
          args.series as SeriesPlan,
          contentFolder,
          args.startDate ? String(args.startDate) : undefined,
          args.cadenceDays ? Number(args.cadenceDays) : 2
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  indexFilePath: result.indexFilePath,
                  episodeFilePaths: result.episodeFilePaths,
                  status: 'planned',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown Mitos MCP tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (err: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${err.message}`,
        },
      ],
      isError: true,
    };
  }
}
