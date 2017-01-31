import * as _ from "lodash";

export const options: { uniqueKey: string, ignore: Array<string> } = {
  // A `uniqueKey` is required, and should be set by the caller.
  uniqueKey: "",
  // A list of keys to ignore in `filterKeys`. This is exported and can be
  // changed by the caller.
  ignore: []
};

// Given a list of `keys`, return a new list with all of the keys listed in
// `ignore` removed.
function filterKeys(keys: Array<string>) {
  return _.filter(keys, (key: string) => !_.includes(options.ignore, key));
}

// Returns true if the first item in the array is a mongo ObjectId.
function checkIfArrayOfObjectIds(array: Array<any>) {
  return !!(array.length && array[0].$oid);
}

function checkDifferentValues(left: Object, right: Object) {
  const leftKeys = filterKeys(_.keys(left));
  const rightKeys = filterKeys(_.keys(right));
  const commonKeys = _.intersection(leftKeys, rightKeys);
  const differences: Array<_.Dictionary<{}>> = [];

  _.each(commonKeys, (key: string) => {
    const leftValue = left[key];
    const rightValue = right[key];
    const isObjectId = !_.isArray(leftValue) &&
      _.isObject(leftValue) &&
      leftValue.$oid;
    const isDate = !_.isArray(leftValue) &&
      _.isObject(leftValue) &&
      leftValue.$date;

    if (_.isObject(leftValue) && !leftValue.$oid) {
      const toDelete: Array<string> = [];

      _.each(leftValue, (value: any, key: string) => {
        if (_.isObject(value) && !_.isArray(value) && value.$oid) {
          toDelete.push(key);
        } else if (_.isArray(value) && checkIfArrayOfObjectIds(value)) {
          toDelete.push(key);
        }
      });

      _.each(toDelete, (key: string) => {
        delete leftValue[key];
        delete rightValue[key];
      });
    }

    // Don't compare the values if they're ObjectIds or dates, since they
    // change between each call to `node make init`.
    if (!isObjectId && !isDate && !_.isEqual(leftValue, rightValue)) {
      differences.push({ key, left: leftValue, right: rightValue });
    }
  });

  return differences;
}

// Given two objects, return keys that appear in one but not the other.
function checkMissingKeys(left: Object, right: Object) {
  const leftKeys = filterKeys(_.keys(left));
  const rightKeys = filterKeys(_.keys(right));

  const inLeftButNotRight = _.difference(leftKeys, rightKeys);
  const inRightButNotLeft = _.difference(rightKeys, leftKeys);

  return { inLeftButNotRight, inRightButNotLeft };
}

// Given two arrays, return elements that appear in one but not the other.
export function checkMissingElements(
  left: _.Dictionary<{}>,
  right: _.Dictionary<{}>
): {
  inLeftButNotRight: Array<_.Dictionary<{}>>,
  inRightButNotLeft: Array<_.Dictionary<{}>>
} {
  // export function checkMissingElements(left: _.Dictionary<{}>, right: _.Dictionary<{}>) {
  const leftKeys = _.map(left, "uniqueKey");
  const rightKeys = _.map(right, "uniqueKey");
  const inLeftButNotRight = _.map(_.difference(leftKeys, rightKeys), (
    key: string
  ) =>
    {
      return _.find(
        left,
        (leftObject: Object) => leftObject[options.uniqueKey] === key
      );
    });
  const inRightButNotLeft = _.map(_.difference(rightKeys, leftKeys), (
    key: string
  ) =>
    {
      return _.find(
        right,
        (rightObject: Object) => rightObject[options.uniqueKey] === key
      );
    });

  return { inLeftButNotRight, inRightButNotLeft };
}

export interface DiffResult {
  inLeftButNotRight: Array<_.Dictionary<{}>>,
  inRightButNotLeft: Array<_.Dictionary<{}>>,
  left: _.Dictionary<{}>,
  right: _.Dictionary<{}>,
  missingKeys: MissingKeys,
  differentValues: Array<_.Dictionary<{}>>
}

export interface MissingKeys {
  inLeftButNotRight: Array<string>,
  inRightButNotLeft: Array<string>
}

// Given two arrays, return an array for each changed object that explains
// whether it has different values or missing keys.
export function diff(
  left: Array<_.Dictionary<{}>>,
  right: Array<_.Dictionary<{}>>
): Array<DiffResult> {
  const result: Array<DiffResult> = [];

  _.each(left, (leftObject: _.Dictionary<{}>) => {
    const rightObject = _.find(
      right,
      (rightObject: Object) =>
        _.isEqual(rightObject[options.uniqueKey], leftObject[options.uniqueKey])
    );

    if (!rightObject) {
      return;
    }

    const ret: DiffResult = {
      missingKeys: { inLeftButNotRight: [], inRightButNotLeft: [] },
      differentValues: [],
      inLeftButNotRight: [],
      inRightButNotLeft: [],
      left: {},
      right: {}
    };

    const missingKeys = checkMissingKeys(leftObject, rightObject);

    if (
      !_.isEmpty(missingKeys.inLeftButNotRight) ||
        !_.isEmpty(missingKeys.inRightButNotLeft)
    ) {
      ret.missingKeys = missingKeys;
    }

    const differentValues = checkDifferentValues(leftObject, rightObject);

    if (!_.isEmpty(differentValues)) {
      ret.differentValues = differentValues;
    }

    if (!_.isEmpty(ret)) {
      result.push(_.extend(ret, { left: leftObject, right: rightObject }));
    }
  });

  return result;
}
