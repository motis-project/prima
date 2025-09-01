export default {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Ensure `filterByUuid` is only assigned `undefined` (ensure all tests are run in CI)',
			recommended: false
		},
		schema: []
	},

	create(context) {
		return {
			VariableDeclarator(node) {
				if (node.id.type === 'Identifier' && node.id.name === 'filterByUuid') {
					const isAssignedToUndefined =
						node.init &&
						((node.init.type === 'Identifier' && node.init.name === 'undefined') ||
							(node.init.type === 'Literal' && node.init.value === undefined));

					if (!isAssignedToUndefined) {
						context.report({
							node,
							message: '`filterByUuid` must be set to `undefined` in CI to run all tests.'
						});
					}
				}
			}
		};
	}
};
