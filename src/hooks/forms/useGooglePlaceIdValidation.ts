import { firestoreConstraints, useFirestore } from "@/hooks/useFirestore";

/**
 * A hook that provides validation for googlePlaceId uniqueness
 * @param currentId - Optional current document ID to exclude from uniqueness check (for edit form)
 * @returns A validation function that can be used with react-hook-form
 */
export const useGooglePlaceIdValidation = (currentId?: string) => {
	const { checkDocumentExists, getDocuments } = useFirestore("shops");
	const { where, limit } = firestoreConstraints;

	const validateGooglePlaceId = async (googlePlaceId: string | undefined) => {
		// If googlePlaceId is undefined or empty, it's valid (optional field)
		if (!googlePlaceId) {
			return true;
		}

		try {
			// Check if a document with this googlePlaceId exists
			const exists = await checkDocumentExists(
				"googlePlaceId",
				googlePlaceId,
			);

			// If we're in edit mode and there's a currentId
			if (exists && currentId) {
				// Get the document that has this googlePlaceId
				const docs = await getDocuments([
					where("googlePlaceId", "==", googlePlaceId),
					limit(1),
				]);
				// If the document with this googlePlaceId is the current document, it's valid
				if (docs[0]?.id === currentId) {
					return true;
				}
			}

			// Return error message if exists, true if doesn't exist
			return exists ? "此店家已經存在於資料庫中" : true;
		} catch (error) {
			console.error("Error validating googlePlaceId:", error);
			return "驗證店家ID時發生錯誤";
		}
	};

	return validateGooglePlaceId;
};
