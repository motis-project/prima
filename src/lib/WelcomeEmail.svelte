<script>
	import { Button, Hr, Html, Text } from 'svelte-email';
  export let name = "World";
</script>

<Html lang="en">
	<Text>
		Hello, {name}!
	</Text>
	<Hr />
	<Button href="https://svelte.dev">Visit Svelte</Button>
</Html>

<!-- <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Example Email</title>
  <style>
    /* Inline styles for better email client compatibility */
    body {
      font-family: Arial, sans-serif;
      width: 600px;
      margin: 0 auto;
      padding: 20px;
      border: 1px solid #ddd;
    }
    h1 {
      color: #00698f;
      font-weight: bold;
      margin-top: 0;
    }
    p {
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <h1>Welcome to Our Email Example</h1>
  <p>This is a simple HTML email template.</p>
  <p>It demonstrates basic HTML and CSS usage.</p>
  <p><a href="https://example.com">Visit our website</a></p>
</body>
</html> -->