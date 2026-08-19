#!/usr/bin/env node

/**
 * Verification Script: Lab Referral Table Naming
 *
 * Run: node scripts/verify-referral-table.js
 *
 * This script verifies that:
 * 1. The "lab_referrals" table exists in the database
 * 2. The "lab_referral_items" table exists
 * 3. The "referral_id" column exists on "lab_test_results"
 * 4. The Sequelize model resolves to the correct table name
 * 5. A basic query against the referral tables succeeds
 *
 * This script is READ-ONLY and does NOT modify any data.
 */

require('dotenv').config();
const sequelize = require('../config/database');
const db = require('../models');

async function verify() {
  console.log('🔍 Verifying Lab Referral Table Naming...\n');
  const results = { passed: 0, failed: 0, warnings: 0 };

  function pass(msg) { console.log(`  ✅ ${msg}`); results.passed++; }
  function fail(msg) { console.log(`  ❌ ${msg}`); results.failed++; }
  function warn(msg) { console.log(`  ⚠️  ${msg}`); results.warnings++; }

  try {
    await sequelize.authenticate();
    console.log('  ✅ Database connection successful\n');

    // 1. Check lab_referrals table exists
    const [labReferralsTable] = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lab_referrals'
      ) as exists`
    );
    if (labReferralsTable[0].exists) {
      pass('Table "lab_referrals" exists');
    } else {
      fail('Table "lab_referrals" does NOT exist');
    }

    // 2. Check lab_referral_items table exists
    const [labReferralItemsTable] = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'lab_referral_items'
      ) as exists`
    );
    if (labReferralItemsTable[0].exists) {
      pass('Table "lab_referral_items" exists');
    } else {
      fail('Table "lab_referral_items" does NOT exist');
    }

    // 3. Check referral_id column on lab_test_results
    const [referralIdCol] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'lab_test_results' AND column_name = 'referral_id'`
    );
    if (referralIdCol.length > 0) {
      pass('Column "referral_id" exists on "lab_test_results"');
    } else {
      fail('Column "referral_id" does NOT exist on "lab_test_results"');
    }

    // 4. Check Sequelize model resolves to correct table
    const LabReferral = db.LabReferral;
    if (LabReferral) {
      const tableName = LabReferral.tableName;
      if (tableName === 'lab_referrals') {
        pass(`Sequelize model "LabReferral" → tableName: "${tableName}"`);
      } else {
        fail(`Sequelize model "LabReferral" → tableName: "${tableName}" (expected "lab_referrals")`);
      }
    } else {
      fail('Sequelize model "LabReferral" not found');
    }

    // 5. Check old referrals table should NOT be the active table
    const [oldReferralsTable] = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'referrals'
      ) as exists`
    );
    if (oldReferralsTable[0].exists) {
      warn('Old table "referrals" still exists (may have been renamed to referrals_old)');
    } else {
      pass('Old table "referrals" does not exist (correct)');
    }

    // 6. Test a basic query
    try {
      const [results] = await sequelize.query(
        `SELECT COUNT(*) as count FROM "lab_referrals"`
      );
      pass(`Query against "lab_referrals" succeeded (${results[0].count} rows)`);
    } catch (err) {
      fail(`Query against "lab_referrals" failed: ${err.message}`);
    }

    // 7. Test lab_referral_items query
    try {
      const [results] = await sequelize.query(
        `SELECT COUNT(*) as count FROM "lab_referral_items"`
      );
      pass(`Query against "lab_referral_items" succeeded (${results[0].count} rows)`);
    } catch (err) {
      fail(`Query against "lab_referral_items" failed: ${err.message}`);
    }

    // 8. Test LabReferral.findAll (Sequelize model query)
    try {
      const count = await LabReferral.count();
      pass(`LabReferral.count() succeeded (${count} records)`);
    } catch (err) {
      fail(`LabReferral.count() failed: ${err.message}`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`Results: ${results.passed} passed, ${results.failed} failed, ${results.warnings} warnings`);
    console.log('='.repeat(50));

    if (results.failed > 0) {
      console.log('\n❌ VERIFICATION FAILED — some checks did not pass');
      process.exit(1);
    } else {
      console.log('\n✅ VERIFICATION PASSED — all critical checks passed');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Verification script error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

verify();
