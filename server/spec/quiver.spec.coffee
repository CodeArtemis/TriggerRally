describe "quiver", ->

  quiver = require "../public/scripts/util/quiver"

  describe "Lock", ->
    it "knows when it's locked", (done) ->
      lock = new quiver.Lock()
      expect(lock.isLocked()).toBe false
      lock.acquire (release) ->
        expect(lock.isLocked()).toBe true
        release()
        expect(lock.isLocked()).toBe false
        done()

    it "queues up calls to acquire", (done) ->
      lock = new quiver.Lock()
      lock.acquire (release1) ->
        lock.acquire (release2) ->
          release2()
          expect(lock.isLocked()).toBe false
          done()
        expect(lock.queue.length).toBe 2
        release1()

  describe "LockedSet", ->
    it "locks each node once", (done) ->
      ls = new quiver.LockedSet
      n = new quiver.Node
      ls.acquireNode n, ->
        ls.acquireNode n, ->
          expect(n.lock.queue.length).toBe 1
          ls.release()
          expect(n.lock.isLocked()).toBe false
          done()

  describe "Node", ->
    describe "_walkOut", ->
      it "can walk a simple graph", (done) ->
        quiver.connect n1 = new quiver.Node,
                       n2 = new quiver.Node
        info = {}
        ls = new quiver.LockedSet()
        quiver._walkOut n1, info, ls, ->
          expect(info[n2.id].deps).toEqual [n1.id + ""]
          ls.release()
          done()

      it "merges diamond paths", (done) ->
        quiver.connect n1 = new quiver.Node,
                       {}
                       n2 = new quiver.Node
                       n3 = new quiver.Node
        quiver.connect n1, {}, n2
        info = {}
        ls = new quiver.LockedSet()
        quiver._walkOut n1, info, ls, ->
          expect(info[n1.id].deps.length).toBe 0
          expect(info[n2.id].deps.length).toBe 2
          expect(info[n3.id].deps.length).toBe 1
          ls.release()
          done()

    describe "_walkIn", ->
      it "can walk a simple graph", (done) ->
        quiver.connect n1 = new quiver.Node,
                       n2 = new quiver.Node
        info = {}
        ls = new quiver.LockedSet()
        quiver._walkIn n2, info, ls, ->
          expect(info[n2.id].deps).toEqual [n1.id + ""]
          ls.release()
          done()

      it "stops at updated nodes", (done) ->
        quiver.connect n1 = new quiver.Node,
                       n2 = new quiver.Node
                       n3 = new quiver.Node
        n1.updated = true
        info = {}
        ls = new quiver.LockedSet()
        quiver._walkIn n3, info, ls, ->
          expect(info[n1.id]).toBeUndefined()
          expect(info[n2.id].deps.length).toBe 0
          expect(info[n3.id].deps.length).toBe 1
          ls.release()
          done()

      it "merges diamond paths", (done) ->
        quiver.connect n1 = new quiver.Node,
                       n2 = new quiver.Node
                       n3 = new quiver.Node
                       n5 = new quiver.Node
        quiver.connect n2,
                       n4 = new quiver.Node
                       n5
        info = {}
        ls = new quiver.LockedSet()
        quiver._walkIn n5, info, ls, ->
          expect(info[n1.id].deps.length).toBe 0
          expect(info[n2.id].deps.length).toBe 1
          expect(info[n3.id].deps.length).toBe 1
          expect(info[n4.id].deps.length).toBe 1
          expect(info[n5.id].deps.length).toBe 2
          ls.release()
          done()

    class Counter
      constructor: ->
        @count = 0
      makeNode: ->
        @count += 1
        return new quiver.Node (ins, outs, callback) =>
          @count -= 1
          callback()

    describe "push", ->
      it "executes each node exactly once", (done) ->
        ctr = new Counter
        quiver.connect(
          n1 = ctr.makeNode()
          ctr.makeNode()
          n2 = ctr.makeNode()
          (ins, outs, callback) ->
            expect(ctr.count).toBe 0
            done()
        )
        quiver.connect n1, ctr.makeNode(), n2
        quiver.push n1

    describe "pull", ->
      it "executes each node exactly once", (done) ->
        ctr = new Counter
        quiver.connect(
          n1 = ctr.makeNode()
          ctr.makeNode()
          n2 = ctr.makeNode()
          n3 = new quiver.Node (ins, outs, callback) ->
            expect(ctr.count).toBe 0
            done()
        )
        quiver.connect n1, ctr.makeNode(), n2
        quiver.pull n3

      it "stops at updated nodes", (done) ->
        ctr = new Counter
        quiver.connect n1 = ctr.makeNode(),
                       n2 = ctr.makeNode()
        quiver.push n1, ->
          expect(ctr.count).toBe 0
          quiver.connect n2, n3 = {}
          quiver.pull n3, ->
            expect(ctr.count).toBe 0
            done()
