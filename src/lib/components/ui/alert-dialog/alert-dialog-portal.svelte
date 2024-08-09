<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	// eslint-disable-next-line
	type $$Props = AlertDialogPrimitive.PortalProps;
</script>

<AlertDialogPrimitive.Portal {...$$restProps}>
	<slot />
</AlertDialogPrimitive.Portal>
