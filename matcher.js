'use strict';
const wcmatch = require('wildcard-match');

function ASTPatternMatcher() {
    this.nodesParents = null;
}

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

ASTPatternMatcher.prototype.getFieldValue = function (data, fieldName) {
    if (fieldName === '$value') {
        return data;
    }
    return data[fieldName];
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
        $lengthGT: (length, data) => data.length > length,
        $lengthLT: (length, data) => data.length < length,
        $lengthGTE: (length, data) => data.length >= length,
        $lengthLTE: (length, data) => data.length <= length,
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

    for (let patternItem of pattern['$values'] || []) {
        let matched = false;
        for (let dataItem of data) {
            let result = this.matchField(patternItem, dataItem);
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
    for (let patternItem of pattern) {
        result = this.matchField(patternItem, data);
        if (result) {
            return true;
        }
    }
    return false;
};

ASTPatternMatcher.prototype.matchSubtree = function (pattern, data) {
    let result;
    for (let fieldName in pattern) {
        if (fieldName.startsWith('$')) {
            if (fieldName === '$where') {
                continue;
            } else if (fieldName === '$in') {
                result = this.matchIn(pattern[fieldName], data);
                if (!result) {
                    return false;
                }
            } else if (fieldName === '$parent') {
                result = this.matchSubtree(
                    pattern[fieldName],
                    this.nodesParents.get(data)
                );
                if (!result) {
                    return false;
                }
            }
        } else {
            let fieldValue = this.getFieldValue(data, fieldName);
            if (fieldValue === undefined) {
                return false;
            }
            result = this.matchField(pattern[fieldName], fieldValue);
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
        if (ASTPatternMatcher.isSubtree(value)) {
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
    traverseDepth = Infinity
) {
    const toProcess = [[0, data]];
    this.nodesParents = new Map();
    this.nodesParents.set(data, null);
    while (toProcess.length) {
        const [currentNodeDepth, currentNode] = toProcess.pop();
        if (currentNode === null) {
            //filtering "null" nodes - for instance arr = [,,,]
            continue;
        }

        if (currentNodeDepth > traverseDepth) {
            continue;
        }
        const result = this.matchSubtree(pattern, currentNode);
        if (result) {
            let check = this.detectBoundaries(currentNode, depth, length);
            if (check) {
                yield check;
            }
            if (pattern['$break']) {
                continue;
            }
        }
        let currentNodeChildren = ASTPatternMatcher.getChildNodes(currentNode);
        for (let child of currentNodeChildren) {
            if (ASTPatternMatcher.isSubtree(child)) {
                this.nodesParents.set(child, currentNode);
            }
        }
        const childDepth = currentNodeDepth + 1;
        toProcess.push(...currentNodeChildren.map((c) => [childDepth, c]));
    }
    return false;
};

ASTPatternMatcher.prototype.detectBoundaries = function (node, depth, length) {
    if (depth <= 0) {
        return [node, [node.start, node.end]];
    }

    let currentNode;
    while (depth) {
        const parent = this.nodesParents.get(node);
        if (parent !== null) {
            currentNode = node;
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
    return [currentNode, [currentNode.start, currentNode.end]];
};

exports.ASTPatternMatcher = ASTPatternMatcher;
