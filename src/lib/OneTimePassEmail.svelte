<script>
	import { Button, Hr, Html, Text } from 'svelte-email';

	export let name = 'World';
</script>

<Html lang="en">
	<Text>
		Hello, {name}!
        This is the One Time Password: 
	</Text>
	<Hr />
	<Button href="https://svelte.dev">Visit Svelte</Button>
</Html>