const _ = require("lodash");

let ignore = [];
let uniqueKey = "";

function filterKeys(keys) {
  return _.filter(keys, key => !_.includes(ignore, key));
}

function checkIfArrayOfObjectIds(array) {
  return !!(_.isArray(array) && array.length && array[0].$oid);
}

function checkDifferentValues(left, right) {
  const leftKeys = filterKeys(_.keys(left));
  const rightKeys = filterKeys(_.keys(right));
  const commonKeys = _.intersection(leftKeys, rightKeys);
  const differences = [];

  _.each(commonKeys, key => {
    const leftValue = left[key];
    const rightValue = right[key];
    const isObjectId = !_.isArray(leftValue) &&
      _.isObject(leftValue) &&
      leftValue.$oid;
    const isDate = !_.isArray(leftValue) &&
      _.isObject(leftValue) &&
      leftValue.$date;

    if (_.isObject(leftValue) && !leftValue.$oid) {
      const toDelete = [];

      _.each(leftValue, (value, key) => {
        if (_.isObject(value) && !_.isArray(value) && value.$oid) {
          toDelete.push(key);
        } else if (_.isArray(value) && checkIfArrayOfObjectIds(value)) {
          toDelete.push(key);
        }
      });

      _.each(toDelete, key => {
        delete leftValue[key];
        delete rightValue[key];
      });
    }

    // Don't compare the values if they're ObjectIds or dates, since they
    // change between each call to `node make init`.
    if (!isObjectId && !isDate && !_.isEqual(leftValue, rightValue)) {
      differences.push({key, left: leftValue, right: rightValue});
    }
  });

  return differences;
}

function checkMissingKeys(left, right) {
  const leftKeys = filterKeys(_.keys(left));
  const rightKeys = filterKeys(_.keys(right));

  const inLeftButNotRight = _.difference(leftKeys, rightKeys);
  const inRightButNotLeft = _.difference(rightKeys, leftKeys);

  return {inLeftButNotRight, inRightButNotLeft};
}

function checkMissingElements(left, right) {
  const leftKeys = _.map(left, "uniqueKey");
  const rightKeys = _.map(right, "uniqueKey");
  const inLeftButNotRight = _.map(_.difference(leftKeys, rightKeys), key => {
    return _.find(left, leftObject => leftObject[uniqueKey] === key);
  });
  const inRightButNotLeft = _.map(_.difference(rightKeys, leftKeys), key => {
    return _.find(right, rightObject => rightObject[uniqueKey] === key);
  });

  return {inLeftButNotRight, inRightButNotLeft};
}

function diff(left, right) {
  const result = [];

  _.each(left, leftObject => {
    const rightObject = _.find(
      right,
      rightObject => _.isEqual(rightObject[uniqueKey], leftObject[uniqueKey])
    );

    if (!rightObject) {
      return;
    }

    const ret = {};

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
      result.push(_.extend(ret, {left: leftObject, right: rightObject}));
    }
  });

  return result;
}

module.exports = {
  checkDifferentValues,
  checkMissingKeys,
  checkMissingElements,
  diff,
  ignore,
  uniqueKey
};
