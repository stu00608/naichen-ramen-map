import * as admin from "firebase-admin";
import type { UserProfile } from "./index";

// Initialize Firebase Admin
const serviceAccount = require("../../service-account.json");
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function testFunctions() {
	try {
		// 1. Create a test user
		const testUser: UserProfile = {
			uid: "test-user-1",
			email: "test@example.com",
			displayName: "Test User",
			avatar: "https://example.com/avatar.jpg",
			role: "NORMAL",
		};

		await db.collection("users").doc(testUser.uid).set(testUser);
		console.log("Created test user:", testUser.uid);

		// 2. Create some test reviews
		const testReviews = [
			{
				user_id: testUser.uid,
				user_name: testUser.displayName,
				user_avatar: testUser.avatar,
				user_role: testUser.role,
				content: "Test review 1",
			},
			{
				user_id: testUser.uid,
				user_name: testUser.displayName,
				user_avatar: testUser.avatar,
				user_role: testUser.role,
				content: "Test review 2",
			},
		];

		for (const review of testReviews) {
			await db.collection("reviews").add(review);
		}
		console.log("Created test reviews");

		// 3. Test syncUserProfileToReviews by updating user
		const updatedUser = {
			...testUser,
			displayName: "Updated Test User",
			avatar: "https://example.com/new-avatar.jpg",
		};

		await db.collection("users").doc(testUser.uid).update(updatedUser);
		console.log("Updated user profile");

		// Wait for the function to process
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// 4. Verify reviews were updated
		const updatedReviews = await db
			.collection("reviews")
			.where("user_id", "==", testUser.uid)
			.get();

		updatedReviews.forEach((doc) => {
			const data = doc.data();
			console.log("Updated review:", {
				user_name: data.user_name,
				user_avatar: data.user_avatar,
			});
		});

		// 5. Test handleUserDeletion by deleting user
		await db.collection("users").doc(testUser.uid).delete();
		console.log("Deleted test user");

		// Wait for the function to process
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// 6. Verify reviews were anonymized
		const anonymizedReviews = await db
			.collection("reviews")
			.where("user_id", "==", testUser.uid)
			.get();

		anonymizedReviews.forEach((doc) => {
			const data = doc.data();
			console.log("Anonymized review:", {
				user_name: data.user_name,
				user_avatar: data.user_avatar,
				user_role: data.user_role,
			});
		});
	} catch (error) {
		console.error("Test failed:", error);
	}
}

// Run the tests
testFunctions()
	.then(() => {
		console.log("Tests completed");
		process.exit(0);
	})
	.catch((error) => {
		console.error("Tests failed:", error);
		process.exit(1);
	});
