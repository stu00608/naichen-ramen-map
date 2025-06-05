import * as admin from "firebase-admin";
import type {
	DocumentSnapshot,
	QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import type { Change, EventContext } from "firebase-functions";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
	admin.initializeApp();
}

const db = admin.firestore();

interface UserProfile {
	uid: string;
	email: string;
	displayName: string;
	avatar: string | null;
	role: string;
}

/**
 * Cloud Function to sync user profile changes to reviews
 * Triggers when a user document is updated
 */
export const syncUserProfileToReviews = functions.firestore
	.document("users/{userId}")
	.onUpdate(async (change: Change<DocumentSnapshot>, context: EventContext) => {
		const newData = change.after.data() as UserProfile;
		const previousData = change.before.data() as UserProfile;
		const userId = context.params.userId;

		// Check if relevant user data has changed
		const hasRelevantChanges =
			newData.displayName !== previousData.displayName ||
			newData.avatar !== previousData.avatar ||
			newData.role !== previousData.role;

		if (!hasRelevantChanges) {
			console.log(
				"No relevant changes to user profile, skipping review updates",
			);
			return null;
		}

		try {
			// Get all reviews by this user
			const reviewsSnapshot = await db
				.collection("reviews")
				.where("user_id", "==", userId)
				.get();

			if (reviewsSnapshot.empty) {
				console.log("No reviews found for user:", userId);
				return null;
			}

			// Prepare batch updates
			const batch = db.batch();
			const updatedData = {
				user_name: newData.displayName,
				user_avatar: newData.avatar,
				user_role: newData.role,
				updated_at: admin.firestore.FieldValue.serverTimestamp(),
			};

			// Add each review update to the batch
			reviewsSnapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
				batch.update(doc.ref, updatedData);
			});

			// Commit the batch
			await batch.commit();
			console.log(
				`Successfully updated ${reviewsSnapshot.size} reviews for user:`,
				userId,
			);
			return { updated: reviewsSnapshot.size };
		} catch (error) {
			console.error("Error updating reviews:", error);
			throw new functions.https.HttpsError(
				"internal",
				"Failed to update reviews",
			);
		}
	});

/**
 * Cloud Function to handle user deletion
 * Anonymizes all reviews when a user is deleted
 */
export const handleUserDeletion = functions.firestore
	.document("users/{userId}")
	.onDelete(async (snap: DocumentSnapshot, context: EventContext) => {
		const userId = context.params.userId;

		try {
			// Get all reviews by this user
			const reviewsSnapshot = await db
				.collection("reviews")
				.where("user_id", "==", userId)
				.get();

			if (reviewsSnapshot.empty) {
				console.log("No reviews found for deleted user:", userId);
				return null;
			}

			// Prepare batch updates to anonymize reviews
			const batch = db.batch();
			const anonymousData = {
				user_name: "[Deleted User]",
				user_avatar: null,
				user_role: "DELETED",
				updated_at: admin.firestore.FieldValue.serverTimestamp(),
			};

			// Add each review update to the batch
			reviewsSnapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
				batch.update(doc.ref, anonymousData);
			});

			// Commit the batch
			await batch.commit();
			console.log(
				`Successfully anonymized ${reviewsSnapshot.size} reviews for deleted user:`,
				userId,
			);
			return { anonymized: reviewsSnapshot.size };
		} catch (error) {
			console.error("Error handling user deletion:", error);
			throw new functions.https.HttpsError(
				"internal",
				"Failed to process user deletion",
			);
		}
	});
