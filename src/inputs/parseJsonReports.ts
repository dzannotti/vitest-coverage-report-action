import { readFile } from "node:fs/promises";
import path from "node:path";
import * as core from "@actions/core";
import { stripIndent } from "common-tags";
import type { JsonFinal } from "../types/JsonFinal";
import type { JsonSummary } from "../types/JsonSummary";

const parseBunCoverageReport = async <type extends JsonSummary | JsonFinal>(
	jsonPath: string,
): Promise<type> => {
	const resolvedJsonSummaryPath = path.resolve(process.cwd(), jsonPath);
	const jsonSummaryRaw = await readFile(resolvedJsonSummaryPath);
	return JSON.parse(jsonSummaryRaw.toString()) as type;
};

const parseBunJsonSummary = async (
	jsonSummaryPath: string,
): Promise<JsonSummary> => {
	try {
		return await parseBunCoverageReport<JsonSummary>(jsonSummaryPath);
	} catch (err: unknown) {
		const stack = err instanceof Error ? err.stack : "";
		core.setFailed(stripIndent`
        Failed to parse the json-summary at path "${jsonSummaryPath}."
        Make sure to run bun test --coverage before this action and to include the "json-summary" reporter.

        Original Error:
        ${stack}
    `);

		// Rethrow to abort the entire workflow
		throw err;
	}
};

const parseBunJsonFinal = async (
	jsonFinalPath: string,
): Promise<JsonFinal> => {
	try {
		return await parseBunCoverageReport<JsonFinal>(jsonFinalPath);
	} catch (err: unknown) {
		const stack = err instanceof Error ? err.stack : "";
		core.warning(stripIndent`
      Failed to parse JSON Final at path "${jsonFinalPath}".
      Line coverage will be empty. To include it, make sure to include the "json" reporter in your bun test execution.

      Original Error:
      ${stack}
    `);
		return {};
	}
};

export { parseBunJsonSummary as parseVitestJsonSummary, parseBunJsonFinal as parseVitestJsonFinal };
