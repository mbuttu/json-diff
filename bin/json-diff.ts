#!/usr/bin/env node

/*eslint no-console:0*/

import * as _ from "lodash";
import * as fs from "fs";
import * as path from "path";
import * as differ from "../lib/differ";
import * as chalk from "chalk";
import * as jsdiff from "diff";

function jsonDiff(left: _.Dictionary<{}>, right: _.Dictionary<{}>) {
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

  console.log(diff);
}

const {checkMissingElements, diff} = differ;

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

differ.options.ignore = ["_id", "createdOn", "modifiedOn", "__v"];

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
  console.log(`In ${leftFileName} but not ${rightFileName}`);
  console.log();
  console.log(JSON.stringify(missingElements.inLeftButNotRight, null, 2));
  console.log();
}

if (missingElements.inRightButNotLeft.length) {
  console.log(`In ${rightFileName} but not ${leftFileName}`);
  console.log();
  console.log(JSON.stringify(missingElements.inRightButNotLeft, null, 2));
  console.log();
}

const differences = diff(left, right);

if (differences.length) {
  console.log(`Differences between ${leftFileName} and ${rightFileName}`);
  console.log();

  _.each(differences, ({left, right, differentValues, missingKeys}) => {
    console.log(`Unique Object Id: ${left[uniqueKey]}`);
    console.log();

    if (differentValues) {
      console.log("Difference in values");

      _.each(differentValues, ({key, left: leftValue, right: rightValue}) => {
        console.log(`${pad("key")}: ${key}`);
        if (_.isObject(leftValue) && _.isObject(rightValue)) {
          return jsonDiff(leftValue, rightValue);
        }

        console.log(
          `${pad(leftFileName)}: ${JSON.stringify(leftValue, null, 2)}`
        );
        console.log(
          `${pad(rightFileName)}: ${JSON.stringify(rightValue, null, 2)}`
        );
        console.log();
      });
    }

    if (
      missingKeys &&
        (missingKeys.inLeftButNotRight &&
          missingKeys.inLeftButNotRight.length ||
          missingKeys.inRightButNotLeft && missingKeys.inRightButNotLeft.length)
    ) {
      console.log("Difference in keys");
      console.log();

      if (missingKeys.inLeftButNotRight.length) {
        console.log(`keys in ${leftFileName} but not in ${rightFileName}`);
        console.log();

        _.each(missingKeys.inLeftButNotRight, missingKey => {
          console.log(`${pad("key")}: ${missingKey}`);
          console.log(
            `${pad(leftFileName)}: ${JSON.stringify(left[missingKey], null, 2)}`
          );
          console.log(
            `${pad(rightFileName)}: ${JSON.stringify(
              right[missingKey],
              null,
              2
            )}`
          );
          console.log();
        });
      }

      if (missingKeys.inRightButNotLeft.length) {
        console.log(`keys in ${rightFileName} but not in ${leftFileName}`);
        console.log();

        _.each(missingKeys.inRightButNotLeft, missingKey => {
          console.log(`${pad("key")}: ${missingKey}`);
          console.log(
            `${pad(leftFileName)}: ${JSON.stringify(left[missingKey], null, 2)}`
          );
          console.log(
            `${pad(rightFileName)}: ${JSON.stringify(
              right[missingKey],
              null,
              2
            )}`
          );
          console.log();
        });
      }
    }
  });
}
