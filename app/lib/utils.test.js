const utils = require("./utils")
// @ponicode
describe("utils.checkHttp", () => {
    test("0", () => {
        let callFunction = () => {
            utils.checkHttp("ponicode.com")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("1", () => {
        let callFunction = () => {
            utils.checkHttp("www.google.com")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("2", () => {
        let callFunction = () => {
            utils.checkHttp("https://")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("3", () => {
        let callFunction = () => {
            utils.checkHttp("http://www.example.com/route/123?foo=bar")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("4", () => {
        let callFunction = () => {
            utils.checkHttp("http://base.com")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("5", () => {
        let callFunction = () => {
            utils.checkHttp(undefined)
        }
    
        expect(callFunction).not.toThrow()
    })
})

// @ponicode
describe("utils.isWorkInProgress", () => {
    test("0", () => {
        let callFunction = () => {
            utils.isWorkInProgress("Dynamic Quality Specialist")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("1", () => {
        let callFunction = () => {
            utils.isWorkInProgress("New York")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("2", () => {
        let callFunction = () => {
            utils.isWorkInProgress("Roma")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("3", () => {
        let callFunction = () => {
            utils.isWorkInProgress("Direct Functionality Orchestrator")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("4", () => {
        let callFunction = () => {
            utils.isWorkInProgress("Future Interactions Representative")
        }
    
        expect(callFunction).not.toThrow()
    })

    test("5", () => {
        let callFunction = () => {
            utils.isWorkInProgress(undefined)
        }
    
        expect(callFunction).not.toThrow()
    })
})

// @ponicode
describe("utils.getMdInfo", () => {
    test("0", async () => {
        await utils.getMdInfo("Www.GooGle.com")
    })

    test("1", async () => {
        await utils.getMdInfo("ponicode.com")
    })

    test("2", async () => {
        await utils.getMdInfo("https://twitter.com/path?abc")
    })

    test("3", async () => {
        await utils.getMdInfo("http://base.com")
    })

    test("4", async () => {
        await utils.getMdInfo("https://")
    })

    test("5", async () => {
        await utils.getMdInfo(undefined)
    })
})
