import { readFile } from "node:fs/promises";
import path from "node:path";
import * as core from "@actions/core";
import { stripIndent } from "common-tags";
import type { JsonFinal, FileCoverageReport } from "../types/JsonFinal";
import type { JsonSummary, CoverageReport } from "../types/JsonSummary";

interface LcovRecord {
	sourceFile: string;
	lines: Array<{ line: number; hit: number }>;
	functions: { found: number; hit: number };
	branches: { found: number; hit: number };
}

const parseLcovData = (lcovContent: string): LcovRecord[] => {
	const records: LcovRecord[] = [];
	const lines = lcovContent.split('\n');
	let currentRecord: Partial<LcovRecord> | null = null;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		if (trimmed.startsWith('SF:')) {
			// Source file - start new record
			currentRecord = {
				sourceFile: trimmed.substring(3),
				lines: [],
				functions: { found: 0, hit: 0 },
				branches: { found: 0, hit: 0 }
			};
		} else if (trimmed.startsWith('DA:')) {
			// Line data: DA:line,hit_count
			const [lineStr, hitStr] = trimmed.substring(3).split(',');
			const lineNum = parseInt(lineStr, 10);
			const hitCount = parseInt(hitStr, 10);
			if (currentRecord) {
				currentRecord.lines!.push({ line: lineNum, hit: hitCount });
			}
		} else if (trimmed.startsWith('FNF:')) {
			// Functions found
			if (currentRecord) {
				currentRecord.functions!.found = parseInt(trimmed.substring(4), 10);
			}
		} else if (trimmed.startsWith('FNH:')) {
			// Functions hit
			if (currentRecord) {
				currentRecord.functions!.hit = parseInt(trimmed.substring(4), 10);
			}
		} else if (trimmed.startsWith('BRF:')) {
			// Branches found
			if (currentRecord) {
				currentRecord.branches!.found = parseInt(trimmed.substring(4), 10);
			}
		} else if (trimmed.startsWith('BRH:')) {
			// Branches hit
			if (currentRecord) {
				currentRecord.branches!.hit = parseInt(trimmed.substring(4), 10);
			}
		} else if (trimmed === 'end_of_record') {
			// End of record
			if (currentRecord && currentRecord.sourceFile) {
				records.push(currentRecord as LcovRecord);
			}
			currentRecord = null;
		}
	}

	return records;
};

const lcovToCoverageReport = (records: LcovRecord[]): CoverageReport => {
	let totalLines = 0;
	let coveredLines = 0;
	let totalFunctions = 0;
	let coveredFunctions = 0;
	let totalBranches = 0;
	let coveredBranches = 0;
	let totalStatements = 0;
	let coveredStatements = 0;

	for (const record of records) {
		// Lines
		totalLines += record.lines.length;
		coveredLines += record.lines.filter(l => l.hit > 0).length;

		// Functions
		totalFunctions += record.functions.found;
		coveredFunctions += record.functions.hit;

		// Branches
		totalBranches += record.branches.found;
		coveredBranches += record.branches.hit;

		// Statements (same as lines for LCOV)
		totalStatements += record.lines.length;
		coveredStatements += record.lines.filter(l => l.hit > 0).length;
	}

	return {
		lines: {
			total: totalLines,
			covered: coveredLines,
			skipped: 0,
			pct: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100 * 100) / 100 : 0
		},
		statements: {
			total: totalStatements,
			covered: coveredStatements,
			skipped: 0,
			pct: totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100 * 100) / 100 : 0
		},
		functions: {
			total: totalFunctions,
			covered: coveredFunctions,
			skipped: 0,
			pct: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100 * 100) / 100 : 0
		},
		branches: {
			total: totalBranches,
			covered: coveredBranches,
			skipped: 0,
			pct: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100 * 100) / 100 : 0
		}
	};
};

const lcovToJsonSummary = (records: LcovRecord[]): JsonSummary => {
	const summary: JsonSummary = {
		total: lcovToCoverageReport(records)
	};

	// Add individual file reports
	for (const record of records) {
		const fileCoverage = lcovToCoverageReport([record]);
		summary[record.sourceFile] = fileCoverage;
	}

	return summary;
};

const lcovToJsonFinal = (records: LcovRecord[]): JsonFinal => {
	const final: JsonFinal = {};

	for (const record of records) {
		const statementMap: any = {};
		const statementCoverage: any = {};

		// Convert line data to statement data
		record.lines.forEach((line, index) => {
			const stmtId = String(index);
			statementMap[stmtId] = {
				start: { line: line.line, column: 0 },
				end: { line: line.line, column: 100 }
			};
			statementCoverage[stmtId] = line.hit;
		});

		final[record.sourceFile] = {
			path: record.sourceFile,
			all: false,
			statementMap,
			s: statementCoverage
		};
	}

	return final;
};

const parseBunLcovSummary = async (lcovPath: string): Promise<JsonSummary> => {
	try {
		const resolvedPath = path.resolve(process.cwd(), lcovPath);
		const lcovContent = await readFile(resolvedPath, 'utf8');
		const records = parseLcovData(lcovContent);
		return lcovToJsonSummary(records);
	} catch (err: unknown) {
		const stack = err instanceof Error ? err.stack : "";
		core.setFailed(stripIndent`
			Failed to parse the LCOV file at path "${lcovPath}."
			Make sure to run bun test --coverage --coverage-reporter=lcov before this action.

			Original Error:
			${stack}
		`);
		throw err;
	}
};

const parseBunLcovFinal = async (lcovPath: string): Promise<JsonFinal> => {
	try {
		const resolvedPath = path.resolve(process.cwd(), lcovPath);
		const lcovContent = await readFile(resolvedPath, 'utf8');
		const records = parseLcovData(lcovContent);
		return lcovToJsonFinal(records);
	} catch (err: unknown) {
		const stack = err instanceof Error ? err.stack : "";
		core.warning(stripIndent`
			Failed to parse LCOV file at path "${lcovPath}".
			Line coverage will be empty. To include it, make sure to run bun test --coverage --coverage-reporter=lcov.

			Original Error:
			${stack}
		`);
		return {};
	}
};

export { parseBunLcovSummary, parseBunLcovFinal };