const admin = require("firebase-admin");
const { Review } = require("@/types");
const { UserProfile } = require("@/types/auth");
const serviceAccount = require("../../service-account.json");
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

// Initialize Firebase Admin
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateReviews() {
	try {
		// Get all reviews
		const reviewsSnapshot = await db.collection("reviews").get();

		if (reviewsSnapshot.empty) {
			console.log("No reviews to migrate");
			return;
		}

		// Get all users for efficient lookup
		const usersSnapshot = await db.collection("users").get();
		const userMap = new Map<string, typeof UserProfile>();

		for (const doc of usersSnapshot.docs) {
			userMap.set(doc.id, doc.data() as typeof UserProfile);
		}

		// Prepare batch updates
		let batch = db.batch();
		let operationCount = 0;
		const BATCH_SIZE = 500; // Firestore limit is 500 operations per batch

		for (const doc of reviewsSnapshot.docs) {
			const review = doc.data() as typeof Review;
			const user = userMap.get(review.user_id);

			if (!user) {
				console.log(`No user found for review ${doc.id}, using default values`);
				continue;
			}

			// Update review with user data
			const updateData = {
				user_name: user.displayName || "[Unknown User]",
				user_avatar: user.avatar,
				user_role: user.role || "NORMAL",
				updated_at: admin.firestore.FieldValue.serverTimestamp(),
			};

			batch.update(doc.ref, updateData);
			operationCount++;

			// If we've reached the batch limit, commit and start a new batch
			if (operationCount >= BATCH_SIZE) {
				await batch.commit();
				console.log(`Committed batch of ${operationCount} operations`);
				batch = db.batch();
				operationCount = 0;
			}
		}

		// Commit any remaining operations
		if (operationCount > 0) {
			await batch.commit();
			console.log(`Committed final batch of ${operationCount} operations`);
		}

		console.log("Migration completed successfully");
	} catch (error) {
		console.error("Error during migration:", error);
		throw error;
	}
}

// Run the migration
migrateReviews()
	.then(() => {
		console.log("Migration script completed");
		process.exit(0);
	})
	.catch((error) => {
		console.error("Migration failed:", error);
		process.exit(1);
	});
