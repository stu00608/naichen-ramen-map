import { useFirestore, firestoreConstraints } from "@/hooks/useFirestore"

/**
 * A hook that provides validation for google_place_id uniqueness
 * @param currentId - Optional current document ID to exclude from uniqueness check (for edit form)
 * @returns A validation function that can be used with react-hook-form
 */
export const useGooglePlaceIdValidation = (currentId?: string) => {
  const { checkDocumentExists, getDocuments } = useFirestore("shops")
  const { where, limit } = firestoreConstraints

  const validateGooglePlaceId = async (google_place_id: string | undefined) => {
    // If google_place_id is undefined or empty, it's valid (optional field)
    if (!google_place_id) {
      return true
    }

    try {
      // Check if a document with this google_place_id exists
      const exists = await checkDocumentExists("google_place_id", google_place_id)

      // If we're in edit mode and there's a currentId
      if (exists && currentId) {
        // Get the document that has this google_place_id
        const docs = await getDocuments([
          where("google_place_id", "==", google_place_id),
          limit(1)
        ])
        // If the document with this google_place_id is the current document, it's valid
        if (docs[0]?.id === currentId) {
          return true
        }
      }

      // Return error message if exists, true if doesn't exist
      return exists ? "此店家已經存在於資料庫中" : true
    } catch (error) {
      console.error("Error validating google_place_id:", error)
      return "驗證店家ID時發生錯誤"
    }
  }

  return validateGooglePlaceId
} 