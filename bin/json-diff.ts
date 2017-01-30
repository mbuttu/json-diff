#!/usr/bin/env node

import * as _ from "lodash";
import * as fs from "fs";
import * as path from "path";
import * as differ from "../lib/differ";
import * as chalk from "chalk";
import * as jsdiff from "diff";
import Stream from "../lib/stream";
import * as pager from "default-pager";

const stream = new Stream();

function jsonDiff(left: _.Dictionary<{}>, right: _.Dictionary<{}>): string {
  let diff = `
${chalk.red(`--- ${leftFileName}`)}
${chalk.green(`+++ ${rightFileName}`)}`;

  const diffParts = jsdiff.diffJson(left, right);

  _.each(diffParts, part => {
    let color = "dim";
    let symbol = " ";

    if (part.added) {
      color = "green";
      symbol = "+";
    } else if (part.removed) {
      color = "red";
      symbol = "-";
    }

    const value = symbol + part.value.slice(1);

    diff += chalk[color](value);
  });

  diff += "\n";

  return diff;
}

const { checkMissingElements, diff } = differ;

const leftFileName = process.argv[2];
const rightFileName = process.argv[3];
const uniqueKey = process.argv[4];

if (!leftFileName || !rightFileName || !uniqueKey) {
  console.log(
    `usage: ./json-diff FILE_1 FILE_2 KEY_USED_TO_SORT

FILE_1 and FILE_2 are assumed to be sorted using KEY_USED_TO_SORT before the
script is run.

Examples:

    ./diff permissions_withoutMigration.json permissions_withMigration.json route
    ./diff permissions_withoutMigration.txt permissions_withMigration.txt route`
  );

  process.exit(1);
}

differ.options.ignore = [ "_id", "createdOn", "modifiedOn", "__v" ];

differ.options.uniqueKey = uniqueKey;

const left = JSON.parse(fs.readFileSync(path.resolve(leftFileName), "utf8"));
const right = JSON.parse(fs.readFileSync(path.resolve(rightFileName), "utf8"));
const paddingLength = Math.max(leftFileName.length, rightFileName.length);

function pad(str: string) {
  const spaces = " ".repeat(paddingLength - str.length);

  return `${str}${spaces}`;
}

const missingElements = checkMissingElements(left, right);

if (missingElements.inLeftButNotRight.length) {
  stream.push(`In ${leftFileName} but not ${rightFileName}`);
  stream.push();
  stream.push(JSON.stringify(missingElements.inLeftButNotRight, null, 2));
  stream.push();
}

if (missingElements.inRightButNotLeft.length) {
  stream.push(`In ${rightFileName} but not ${leftFileName}`);
  stream.push();
  stream.push(JSON.stringify(missingElements.inRightButNotLeft, null, 2));
  stream.push();
}

const differences = diff(left, right);

if (differences.length) {
  stream.push(`Differences between ${leftFileName} and ${rightFileName}`);
  stream.push();

  _.each(differences, ({ left, right, differentValues, missingKeys }, idx) => {

    if (differentValues.length && idx === 0) {
      stream.push(`Unique Object Id: ${left[uniqueKey]}`);
      stream.push();
    }

    if (differentValues.length) {
      stream.push("Difference in values");

      _.each(differentValues, ({ key, left: leftValue, right: rightValue }) => {
        stream.push(`${pad("key")}: ${key}`);
        if (_.isObject(leftValue) && _.isObject(rightValue)) {
          return stream.push(jsonDiff(leftValue, rightValue));
        }

        stream.push(
          `${pad(leftFileName)}: ${JSON.stringify(leftValue, null, 2)}`
        );
        stream.push(
          `${pad(rightFileName)}: ${JSON.stringify(rightValue, null, 2)}`
        );
        stream.push();
      });
    }

    if (
      missingKeys &&
        (missingKeys.inLeftButNotRight &&
          missingKeys.inLeftButNotRight.length ||
          missingKeys.inRightButNotLeft && missingKeys.inRightButNotLeft.length)
    ) {
      stream.push("Difference in keys");
      stream.push();

      if (missingKeys.inLeftButNotRight.length) {
        stream.push(`keys in ${leftFileName} but not in ${rightFileName}`);
        stream.push();

        _.each(missingKeys.inLeftButNotRight, missingKey => {
          stream.push(`${pad("key")}: ${missingKey}`);
          stream.push(
            `${pad(leftFileName)}: ${JSON.stringify(left[missingKey], null, 2)}`
          );
          stream.push(
            `${pad(rightFileName)}: ${JSON.stringify(
              right[missingKey],
              null,
              2
            )}`
          );
          stream.push();
        });
      }

      if (missingKeys.inRightButNotLeft.length) {
        stream.push(`keys in ${rightFileName} but not in ${leftFileName}`);
        stream.push();

        _.each(missingKeys.inRightButNotLeft, missingKey => {
          stream.push(`${pad("key")}: ${missingKey}`);
          stream.push(
            `${pad(leftFileName)}: ${JSON.stringify(left[missingKey], null, 2)}`
          );
          stream.push(
            `${pad(rightFileName)}: ${JSON.stringify(
              right[missingKey],
              null,
              2
            )}`
          );
          stream.push();
        });
      }
    }
  });

  stream.push(null);

  stream.pipe(pager());
}
