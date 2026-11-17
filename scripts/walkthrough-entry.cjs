const suite = require('../dist-test/walkthrough.cjs')
exports.run = async () => {
  try {
    await suite.run()
  } catch (error) {
    console.error(error)
    throw error
  }
}
