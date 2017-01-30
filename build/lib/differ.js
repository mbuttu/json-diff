"use strict";
const _ = require("lodash");
exports.options = {
    // A `uniqueKey` is required, and should be set by the caller.
    uniqueKey: "",
    // A list of keys to ignore in `filterKeys`. This is exported and can be
    // changed by the caller.
    ignore: []
};
// Given a list of `keys`, return a new list with all of the keys listed in
// `ignore` removed.
function filterKeys(keys) {
    return _.filter(keys, (key) => !_.includes(exports.options.ignore, key));
}
// Returns true if the first item in the array is a mongo ObjectId.
function checkIfArrayOfObjectIds(array) {
    return !!(array.length && array[0].$oid);
}
function checkDifferentValues(left, right) {
    const leftKeys = filterKeys(_.keys(left));
    const rightKeys = filterKeys(_.keys(right));
    const commonKeys = _.intersection(leftKeys, rightKeys);
    const differences = [];
    _.each(commonKeys, (key) => {
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
                }
                else if (_.isArray(value) && checkIfArrayOfObjectIds(value)) {
                    toDelete.push(key);
                }
            });
            _.each(toDelete, (key) => {
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
function checkMissingKeys(left, right) {
    const leftKeys = filterKeys(_.keys(left));
    const rightKeys = filterKeys(_.keys(right));
    const inLeftButNotRight = _.difference(leftKeys, rightKeys);
    const inRightButNotLeft = _.difference(rightKeys, leftKeys);
    return { inLeftButNotRight, inRightButNotLeft };
}
// Given two arrays, return elements that appear in one but not the other.
function checkMissingElements(left, right) {
    // export function checkMissingElements(left: _.Dictionary<{}>, right: _.Dictionary<{}>) {
    const leftKeys = _.map(left, "uniqueKey");
    const rightKeys = _.map(right, "uniqueKey");
    const inLeftButNotRight = _.map(_.difference(leftKeys, rightKeys), (key) => {
        return _.find(left, (leftObject) => leftObject[exports.options.uniqueKey] === key);
    });
    const inRightButNotLeft = _.map(_.difference(rightKeys, leftKeys), (key) => {
        return _.find(right, (rightObject) => rightObject[exports.options.uniqueKey] === key);
    });
    return { inLeftButNotRight, inRightButNotLeft };
}
exports.checkMissingElements = checkMissingElements;
// Given two arrays, return an array for each changed object that explains
// whether it has different values or missing keys.
function diff(left, right) {
    const result = [];
    _.each(left, (leftObject) => {
        const rightObject = _.find(right, (rightObject) => _.isEqual(rightObject[exports.options.uniqueKey], leftObject[exports.options.uniqueKey]));
        if (!rightObject) {
            return;
        }
        const ret = {
            missingKeys: { inLeftButNotRight: [], inRightButNotLeft: [] },
            differentValues: [],
            inLeftButNotRight: [],
            inRightButNotLeft: [],
            left: {},
            right: {}
        };
        const missingKeys = checkMissingKeys(leftObject, rightObject);
        if (!_.isEmpty(missingKeys.inLeftButNotRight) ||
            !_.isEmpty(missingKeys.inRightButNotLeft)) {
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
exports.diff = diff;
//# sourceMappingURL=differ.js.map