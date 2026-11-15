/** Runs once when the server starts, before it handles requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { syncExerciseCatalog } = await import("./lib/training/catalog-sync");
    await syncExerciseCatalog();
  } catch (error) {
    // Don't stop the server (the database may not be migrated yet in dev).
    console.error("Could not sync the exercise catalog:", error);
  }
}
