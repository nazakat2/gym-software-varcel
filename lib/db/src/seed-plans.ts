import { db } from "./index";
import { subscriptionPlansTable } from "./schema/subscription-plans";
import { eq } from "drizzle-orm";

/**
 * Seed Subscription Plans
 * Run this to populate the subscription_plans table
 */
async function seedSubscriptionPlans() {
  console.log("🌱 Seeding subscription plans...");

  const plans = [
    {
      name: "Basic",
      slug: "basic",
      description: "Perfect for small gyms getting started",
      monthlyPrice: "2999",
      yearlyPrice: "29999",
      features: [
        "Up to 100 members",
        "Up to 3 staff accounts",
        "Basic reporting",
        "Member management",
        "Attendance tracking",
        "Payment tracking",
        "Email support",
      ],
      maxMembers: "100",
      maxStaff: "3",
      maxBranches: "1",
      displayOrder: "1",
      isActive: true,
    },
    {
      name: "Pro",
      slug: "pro",
      description: "For growing gyms with advanced needs",
      monthlyPrice: "5999",
      yearlyPrice: "59999",
      features: [
        "Up to 500 members",
        "Up to 10 staff accounts",
        "Advanced reporting & analytics",
        "Member management",
        "Attendance tracking",
        "Payment tracking",
        "Inventory management",
        "Trainer commissions",
        "SMS notifications",
        "Priority email support",
      ],
      maxMembers: "500",
      maxStaff: "10",
      maxBranches: "1",
      displayOrder: "2",
      isActive: true,
    },
    {
      name: "Enterprise",
      slug: "enterprise",
      description: "For large gyms and chains",
      monthlyPrice: "14999",
      yearlyPrice: "149999",
      features: [
        "Unlimited members",
        "Unlimited staff accounts",
        "Advanced reporting & analytics",
        "Member management",
        "Attendance tracking",
        "Payment tracking",
        "Inventory management",
        "Trainer commissions",
        "Multi-branch support",
        "SMS notifications",
        "Custom integrations",
        "Dedicated account manager",
        "24/7 priority support",
      ],
      maxMembers: null,
      maxStaff: null,
      maxBranches: "999",
      displayOrder: "3",
      isActive: true,
    },
  ];

  for (const plan of plans) {
    // Check if plan already exists
    const [existing] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.slug, plan.slug))
      .limit(1);

    if (existing) {
      console.log(`  ⏭️  Plan "${plan.name}" already exists, skipping...`);
      continue;
    }

    // Insert plan
    await db.insert(subscriptionPlansTable).values(plan);
    console.log(`  ✅ Created plan: ${plan.name} (${plan.slug})`);
  }

  console.log("✨ Subscription plans seeded successfully!");
}

// Run if called directly
if (require.main === module) {
  seedSubscriptionPlans()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error seeding plans:", error);
      process.exit(1);
    });
}

export { seedSubscriptionPlans };
