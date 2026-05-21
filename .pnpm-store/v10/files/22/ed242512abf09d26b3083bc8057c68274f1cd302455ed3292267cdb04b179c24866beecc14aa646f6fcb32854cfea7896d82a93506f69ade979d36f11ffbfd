"use strict";

var _index = require("../../formatDistanceStrict.cjs");
var _index2 = require("../../parseISO.cjs");
var _nodeAssert = require("./node:assert"); // This is DST test for formatDistanceStrict in the Melbourne timezone

if (process.env.TZ !== "Australia/Melbourne")
  throw new Error("The test must be run with TZ=Australia/Melbourne");

_nodeAssert.default.strictEqual(
  (0, _index.formatDistanceStrict)(
    (0, _index2.parseISO)("2020-04-05T01:00:00+11:00"),
    (0, _index2.parseISO)("2020-04-05T03:00:00+10:00"),
  ),
  "3 hours",
);
