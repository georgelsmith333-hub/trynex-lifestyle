"use strict";

var _index = require("../../formatDistanceStrict.cjs");
var _nodeAssert = require("./node:assert"); // This is DST test for formatDistanceStrict in the Cairo timezone

if (process.env.TZ !== "Africa/Cairo")
  throw new Error("The test must be run with TZ=Africa/Cairo");

_nodeAssert.default.strictEqual(
  (0, _index.formatDistanceStrict)(
    new Date(1986, 3, 4, 10, 32, 0),
    new Date(1986, 4, 4, 10, 32, 0),
  ),
  "1 month",
);
