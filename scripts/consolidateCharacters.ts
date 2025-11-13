#!/usr/bin/env node
import "dotenv/config";

import { consolidateCharacterData } from "@/server/jobs/consolidateCharacterData";

async function main() {
  const [, , storyIdArg] = process.argv;
  const results = await consolidateCharacterData({
    storyId: storyIdArg,
  });

  if (results.length === 0) {
    console.log("No character cards found to consolidate.");
    return;
  }

  for (const result of results) {
    console.log(
      `Story ${result.storyId}: processed ${result.processed} character cards, consolidated ${result.updated}.`
    );
  }
}

main().catch((error) => {
  console.error("Failed to consolidate character data:", error);
  process.exitCode = 1;
});
