'use strict';
const wcmatch = require('wildcard-match');

function ASTPatternMatcher() {}

ASTPatternMatcher.isWildcard = (data) =>
    typeof data === 'object' && ASTPatternMatcher.hasProp(data, '$wildcard');

ASTPatternMatcher.isValue = (data) =>
    typeof data !== 'object' ||
    data === null ||
    ASTPatternMatcher.isWildcard(data);

ASTPatternMatcher.isSubtree = (data) =>
    typeof data === 'object' && !Array.isArray(data) && data !== null;

ASTPatternMatcher.isArray = (data) => Array.isArray(data);

ASTPatternMatcher.isInteger = (data) => Number.isInteger(data);

ASTPatternMatcher.hasProp = (obj, prop) =>
    Object.prototype.hasOwnProperty.call(obj, prop);

ASTPatternMatcher.prototype.matchValue = function (pattern, data) {
    if (pattern === data) {
        return true;
    }
    if (ASTPatternMatcher.isWildcard(pattern)) {
        const isMatch =
            pattern.isMatch ||
            (pattern.isMatch = wcmatch(pattern['$wildcard']));
        return isMatch(data);
    }
};

ASTPatternMatcher.prototype.getFieldValue = function (data, field_name) {
    if (field_name === '$value') {
        return data;
    }
    return data[field_name];
};

ASTPatternMatcher.prototype.checkListLength = function (pattern, data) {
    let result;
    if (ASTPatternMatcher.hasProp(pattern, '$length')) {
        const length = pattern['$length'];
        if (ASTPatternMatcher.isArray(length) && length.length === 2) {
            result = length[0] <= data.length && data.length <= length[1];
        } else if (ASTPatternMatcher.isInteger(length)) {
            result = length === data.length;
        } else {
            throw new Error('Unexpected type for $length');
        }
        if (!result) {
            return false;
        }
    }

    const comparisonFuncs = {
        $length_gt: (length, data) => data.length > length,
        $length_lt: (length, data) => data.length < length,
        $length_gte: (length, data) => data.length >= length,
        $length_lte: (length, data) => data.length <= length,
    };

    for (const [key, func] of Object.entries(comparisonFuncs)) {
        if (!ASTPatternMatcher.hasProp(pattern, key)) {
            continue;
        }
        if (!func(pattern[key], data)) {
            return false;
        }
    }
    return true;
};

ASTPatternMatcher.prototype.fuzzyMatchList = function (pattern, data) {
    if (!this.checkListLength(pattern, data)) {
        return false;
    }

    for (let pattern_item of pattern['$values'] || []) {
        let matched = false;
        for (let data_item of data) {
            let result = this.matchField(pattern_item, data_item);
            if (result) {
                matched = true;
                break;
            }
        }
        if (!matched) {
            return false;
        }
    }
    return true;
};

ASTPatternMatcher.prototype.matchList = function (pattern, data) {
    if (data.length < pattern.length) {
        return false;
    }
    let result;
    for (let i = 0; i < pattern.length; i++) {
        result = this.matchField(pattern[i], data[i]);
        if (!result) {
            return false;
        }
    }
    return true;
};

ASTPatternMatcher.prototype.matchIn = function (pattern, data) {
    let result;
    for (let pattern_item of pattern) {
        result = this.matchField(pattern_item, data);
        if (result) {
            return true;
        }
    }
    return false;
};

ASTPatternMatcher.prototype.matchSubtree = function (pattern, data) {
    let result;
    for (let field_name in pattern) {
        if (field_name.startsWith('$')) {
            if (field_name === '$where') {
                continue;
            } else if (field_name === '$in') {
                result = this.matchIn(pattern[field_name], data);
                if (!result) {
                    return false;
                }
            }
        } else {
            let field_data = this.getFieldValue(data, field_name);
            if (field_data === undefined) {
                return false;
            }
            result = this.matchField(pattern[field_name], field_data);
            if (!result) {
                return false;
            }
        }
    }
    return true;
};

ASTPatternMatcher.prototype.matchField = function (pattern, data) {
    if (ASTPatternMatcher.isValue(pattern) && ASTPatternMatcher.isValue(data)) {
        return this.matchValue(pattern, data);
    } else if (ASTPatternMatcher.isSubtree(pattern)) {
        if (ASTPatternMatcher.isArray(data)) {
            return this.fuzzyMatchList(pattern, data);
        }
        if (data !== null) {
            return this.matchSubtree(pattern, data);
        }
    } else if (ASTPatternMatcher.isArray(pattern)) {
        if (ASTPatternMatcher.isArray(data)) {
            return this.matchList(pattern, data);
        }
    }
    return false;
};

ASTPatternMatcher.getChildNodes = function (node) {
    let children = [];
    for (let [key, value] of Object.entries(node)) {
        if (ASTPatternMatcher.isSubtree(value) && key !== '_parent') {
            children.push(value);
        } else if (ASTPatternMatcher.isArray(value)) {
            children.push(...value);
        }
    }
    return children;
};

ASTPatternMatcher.prototype.match = function* (
    pattern,
    data,
    depth,
    length,
    traverse_depth = Infinity
) {
    let result;
    let to_process = [data];
    let current_node;
    data['_depth'] = 0;
    while (to_process.length) {
        current_node = to_process.pop();
        if (current_node === null) {
            //filtering "null" nodes - for instance arr = [,,,]
            continue;
        }
        if (current_node['_depth'] > traverse_depth) {
            continue;
        }
        result = this.matchSubtree(pattern, current_node);
        if (result) {
            let check = this.detectBoundaries(current_node, depth, length);
            if (check) {
                yield check;
            }
            if (pattern['$break']) {
                continue;
            }
        }
        let current_node_children =
            ASTPatternMatcher.getChildNodes(current_node);
        for (let child of current_node_children) {
            if (ASTPatternMatcher.isSubtree(child)) {
                child['_parent'] = current_node;
                child['_depth'] = current_node['_depth'] + 1;
            }
        }
        to_process.push(...current_node_children);
    }
    return false;
};

ASTPatternMatcher.prototype.detectBoundaries = function (node, depth, length) {
    if (depth <= 0) {
        return [node, [node.start, node.end]];
    }

    let current_node;
    while (depth) {
        if (Object.prototype.hasOwnProperty.call(node, '_parent')) {
            let parent = node['_parent'];
            current_node = node;
            if (
                node.type === 'CallExpression' &&
                node.callee.type === 'FunctionExpression' &&
                !node.callee.id &&
                parent.end - parent.start > length
            ) {
                depth = depth - 1;
            }
            node = parent;
        } else {
            return false;
        }
    }
    return [current_node, [current_node.start, current_node.end]];
};

exports.ASTPatternMatcher = ASTPatternMatcher;
