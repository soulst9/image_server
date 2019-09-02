module.exports = {
  env: {
    node: true,
    es6: true
  },
  extends: "airbnb",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  rules: {
    "no-console": "off",
    quotes: [2, "double", { avoidEscape: false }]
  }
};
