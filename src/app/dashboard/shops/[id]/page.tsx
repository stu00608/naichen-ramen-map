import { use } from "react";
import ShopEditForm from "./ShopEditForm";

export default function EditShopPage({
	params,
}: { params: Promise<{ id: string }> }) {
	const resolvedParams = use(params);
	return <ShopEditForm shopId={resolvedParams.id} />;
}
