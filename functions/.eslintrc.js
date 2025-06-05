module.exports = {
	root: true,
	env: {
		es6: true,
		node: true,
	},
	extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		project: ["tsconfig.json"],
		tsconfigRootDir: __dirname,
		sourceType: "module",
	},
	ignorePatterns: ["/lib/**/*", ".eslintrc.js"],
	plugins: ["@typescript-eslint"],
	rules: {
		quotes: ["error", "double"],
		indent: ["error", 2],
		"@typescript-eslint/no-explicit-any": 1,
		"object-curly-spacing": ["error", "always"],
	},
};
