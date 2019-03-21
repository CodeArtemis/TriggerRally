/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
describe("quiver", function() {

  const quiver = require("../public/scripts/util/quiver");

  describe("Lock", function() {
    it("knows when it's locked", function(done) {
      const lock = new quiver.Lock();
      expect(lock.isLocked()).toBe(false);
      return lock.acquire(function(release) {
        expect(lock.isLocked()).toBe(true);
        release();
        expect(lock.isLocked()).toBe(false);
        return done();
      });
    });

    return it("queues up calls to acquire", function(done) {
      const lock = new quiver.Lock();
      return lock.acquire(function(release1) {
        lock.acquire(function(release2) {
          release2();
          expect(lock.isLocked()).toBe(false);
          return done();
        });
        expect(lock.queue.length).toBe(2);
        return release1();
      });
    });
  });

  describe("LockedSet", () =>
    it("locks each node once", function(done) {
      const ls = new quiver.LockedSet;
      const n = new quiver.Node;
      return ls.acquireNode(n, () =>
        ls.acquireNode(n, function() {
          expect(n.lock.queue.length).toBe(1);
          ls.release();
          expect(n.lock.isLocked()).toBe(false);
          return done();
        })
      );
    })
  );

  return describe("Node", function() {
    describe("_walkOut", function() {
      it("can walk a simple graph", function(done) {
        let n1, n2;
        quiver.connect((n1 = new quiver.Node),
                       (n2 = new quiver.Node));
        const info = {};
        const ls = new quiver.LockedSet();
        return quiver._walkOut(n1, info, ls, function() {
          expect(info[n2.id].deps).toEqual([n1.id + ""]);
          ls.release();
          return done();
        });
      });

      return it("merges diamond paths", function(done) {
        let n1, n2, n3;
        quiver.connect((n1 = new quiver.Node),
                       {},
                       (n2 = new quiver.Node),
                       (n3 = new quiver.Node));
        quiver.connect(n1, {}, n2);
        const info = {};
        const ls = new quiver.LockedSet();
        return quiver._walkOut(n1, info, ls, function() {
          expect(info[n1.id].deps.length).toBe(0);
          expect(info[n2.id].deps.length).toBe(2);
          expect(info[n3.id].deps.length).toBe(1);
          ls.release();
          return done();
        });
      });
    });

    describe("_walkIn", function() {
      it("can walk a simple graph", function(done) {
        let n1, n2;
        quiver.connect((n1 = new quiver.Node),
                       (n2 = new quiver.Node));
        const info = {};
        const ls = new quiver.LockedSet();
        return quiver._walkIn(n2, info, ls, function() {
          expect(info[n2.id].deps).toEqual([n1.id + ""]);
          ls.release();
          return done();
        });
      });

      it("stops at updated nodes", function(done) {
        let n1, n2, n3;
        quiver.connect((n1 = new quiver.Node),
                       (n2 = new quiver.Node),
                       (n3 = new quiver.Node));
        n1.updated = true;
        const info = {};
        const ls = new quiver.LockedSet();
        return quiver._walkIn(n3, info, ls, function() {
          expect(info[n1.id]).toBeUndefined();
          expect(info[n2.id].deps.length).toBe(0);
          expect(info[n3.id].deps.length).toBe(1);
          ls.release();
          return done();
        });
      });

      return it("merges diamond paths", function(done) {
        let n1, n2, n3, n4, n5;
        quiver.connect((n1 = new quiver.Node),
                       (n2 = new quiver.Node),
                       (n3 = new quiver.Node),
                       (n5 = new quiver.Node));
        quiver.connect(n2,
                       (n4 = new quiver.Node),
                       n5);
        const info = {};
        const ls = new quiver.LockedSet();
        return quiver._walkIn(n5, info, ls, function() {
          expect(info[n1.id].deps.length).toBe(0);
          expect(info[n2.id].deps.length).toBe(1);
          expect(info[n3.id].deps.length).toBe(1);
          expect(info[n4.id].deps.length).toBe(1);
          expect(info[n5.id].deps.length).toBe(2);
          ls.release();
          return done();
        });
      });
    });

    class Counter {
      constructor() {
        this.count = 0;
      }
      makeNode() {
        this.count += 1;
        return new quiver.Node((ins, outs, callback) => {
          this.count -= 1;
          return callback();
        });
      }
    }

    describe("push", () =>
      it("executes each node exactly once", function(done) {
        let n1, n2;
        const ctr = new Counter;
        quiver.connect(
          (n1 = ctr.makeNode()),
          ctr.makeNode(),
          (n2 = ctr.makeNode()),
          function(ins, outs, callback) {
            expect(ctr.count).toBe(0);
            return done();
        });
        quiver.connect(n1, ctr.makeNode(), n2);
        return quiver.push(n1);
      })
    );

    return describe("pull", function() {
      it("executes each node exactly once", function(done) {
        let n1, n2, n3;
        const ctr = new Counter;
        quiver.connect(
          (n1 = ctr.makeNode()),
          ctr.makeNode(),
          (n2 = ctr.makeNode()),
          (n3 = new quiver.Node(function(ins, outs, callback) {
            expect(ctr.count).toBe(0);
            return done();}))
        );
        quiver.connect(n1, ctr.makeNode(), n2);
        return quiver.pull(n3);
      });

      return it("stops at updated nodes", function(done) {
        let n1, n2;
        const ctr = new Counter;
        quiver.connect((n1 = ctr.makeNode()),
                       (n2 = ctr.makeNode()));
        return quiver.push(n1, function() {
          let n3;
          expect(ctr.count).toBe(0);
          quiver.connect(n2, (n3 = {}));
          return quiver.pull(n3, function() {
            expect(ctr.count).toBe(0);
            return done();
          });
        });
      });
    });
  });
});
