import * as path from "node:path";
import * as core from "@actions/core";
import type { Octokit } from "../octokit";
import type { Thresholds } from "../types/Threshold";
import { type FileCoverageMode, getCoverageModeFrom } from "./FileCoverageMode";
import { type CommentOn, getCommentOn } from "./getCommentOn";
import { getCommitSHA } from "./getCommitSHA";
import { getPullRequestNumber } from "./getPullRequestNumber";
import { getViteConfigPath } from "./getViteConfigPath";
import { parseCoverageThresholds } from "./parseCoverageThresholds";

type Options = {
	fileCoverageMode: FileCoverageMode;
	lcovPath: string;
	lcovComparePath: string | null;
	name: string;
	thresholds: Thresholds;
	workingDirectory: string;
	prNumber: number | undefined;
	commitSHA: string;
	commentOn: Array<CommentOn>;
	fileCoverageRootPath: string;
};

async function readOptions(octokit: Octokit): Promise<Options> {
	// Working directory can be used to modify all default/provided paths (for monorepos, etc)
	const workingDirectory = core.getInput("working-directory");

	const fileCoverageModeRaw = core.getInput("file-coverage-mode"); // all/changes/none
	const fileCoverageMode = getCoverageModeFrom(fileCoverageModeRaw);

	const lcovPath = path.resolve(
		workingDirectory,
		core.getInput("lcov-path"),
	);

	const lcovCompareInput = core.getInput("lcov-compare-path");
	let lcovComparePath: string | null = null;
	if (lcovCompareInput) {
		lcovComparePath = path.resolve(
			workingDirectory,
			lcovCompareInput,
		);
	}

	const name = core.getInput("name");

	const commentOn = getCommentOn();

	// BunConfig is optional, as it is only required for thresholds. If no bunfig.toml is provided, we will not include thresholds in the final report.
	const viteConfigPath = await getViteConfigPath(
		workingDirectory,
		core.getInput("bunfig-path"),
	);

	const thresholds = viteConfigPath
		? await parseCoverageThresholds(viteConfigPath)
		: {};

	const commitSHA = getCommitSHA();

	let prNumber: number | undefined = undefined;
	if (commentOn.includes("pr")) {
		// Get the user-defined pull-request number and perform input validation
		prNumber = await getPullRequestNumber(octokit);
	}

	const fileCoverageRootPath = core.getInput("file-coverage-root-path");

	return {
		fileCoverageMode,
		lcovPath,
		lcovComparePath,
		name,
		thresholds,
		workingDirectory,
		prNumber,
		commitSHA,
		commentOn,
		fileCoverageRootPath,
	};
}

export { readOptions };

export type { Options };
