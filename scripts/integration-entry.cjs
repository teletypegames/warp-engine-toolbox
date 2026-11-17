const suite = require('../dist-test/integration.cjs')
exports.run = async () => {
  try {
    await suite.run()
  } catch (error) {
    console.error(error)
    throw error
  }
}
