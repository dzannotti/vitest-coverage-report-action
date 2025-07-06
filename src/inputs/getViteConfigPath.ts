import { constants, promises as fs } from "node:fs";
import path from "node:path";
import * as core from "@actions/core";
import { stripIndent } from "common-tags";

const testFilePath = async (workingDirectory: string, filePath: string) => {
	const resolvedPath = path.resolve(workingDirectory, filePath);
	await fs.access(resolvedPath, constants.R_OK);
	return resolvedPath;
};

const defaultPaths = [
	"bunfig.toml",
];

const getBunConfigPath = async (workingDirectory: string, input: string) => {
	try {
		if (input === "") {
			return await Promise.any(
				defaultPaths.map((filePath) =>
					testFilePath(workingDirectory, filePath),
				),
			);
		}

		return await testFilePath(workingDirectory, input);
	} catch (error) {
		const searchPath = input
			? path.resolve(workingDirectory, input)
			: `any default location in "${workingDirectory}"`;

		core.warning(stripIndent`
          Failed to read bunfig.toml file at ${searchPath}.
          Make sure you provide the bunfig-path option if you're using a non-default location or name of your config file.

          Will not include thresholds in the final report.
      `);
		return null;
	}
};

export { getBunConfigPath as getViteConfigPath };
