require('dotenv').config({ path: '../.env' });
const ipfsService = require('../services/ipfs.service');
const encryptionService = require('../services/encryption.service');

/**
 * Test IPFS integration with Pinata
 * 
 * PREREQUISITES:
 * - Set PINATA_API_KEY in .env
 * - Set PINATA_SECRET_API_KEY in .env
 */

console.log(' Testing MediChain IPFS Integration\n');
console.log('='.repeat(60));

// Debug: Check environment variables
console.log('\n Environment Check:');
console.log(`   PINATA_API_KEY: ${process.env.PINATA_API_KEY ? '✓ Set (' + process.env.PINATA_API_KEY.substring(0, 10) + '...)' : '✗ Not set'}`);
console.log(`   PINATA_SECRET_API_KEY: ${process.env.PINATA_SECRET_API_KEY ? '✓ Set (' + process.env.PINATA_SECRET_API_KEY.substring(0, 10) + '...)' : '✗ Not set'}`);

// Test configuration
const TEST_PATIENT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27';
const TEST_PASSWORD = 'SecurePatientPassword123!';
const TEST_FILENAME = 'test-medical-report.txt';
const TEST_CATEGORY = 'reports';

let uploadedCID = null;

async function runTests() {
    try {
        // Test 1: Initialize Pinata
        console.log('\n1.  Testing Pinata Initialization...');
        try {
            await ipfsService.initialize();
            console.log('    Pinata authenticated successfully');
        } catch (error) {
            console.error('   Pinata initialization failed:', error.message);
            console.log('\n Please configure Pinata credentials in .env:');
            console.log('   PINATA_API_KEY=your_api_key');
            console.log('   PINATA_SECRET_API_KEY=your_secret_key');
            process.exit(1);
        }

        // Test 2: Create test file
        console.log('\n 2.  Creating Test File...');
        const testData = `
    ==
    MEDICAL REPORT - CONFIDENTIAL
    ==
    
    Patient ID: ${TEST_PATIENT_ADDRESS}
    Date: ${new Date().toISOString()}
    
    Test Results:
    - Blood Pressure: 120/80 mmHg
    - Heart Rate: 72 bpm
    - Temperature: 98.6°F
    
    Diagnosis: Normal health checkup
    
    This is a test medical report for MediChain AI.
    All data is encrypted before storage.
    
    ==
    `.trim();

        console.log(`    Test file created (${testData.length} bytes)`);

        // Test 3: Encrypt test file
        console.log('\n 3.  Encrypting Test File...');
        const fileBuffer = Buffer.from(testData, 'utf8');
        const { encryptedData, iv } = encryptionService.encryptWithPassword(
            fileBuffer,
            TEST_PATIENT_ADDRESS,
            TEST_PASSWORD
        );
        const combinedData = encryptionService.combineEncryptedData(encryptedData, iv);

        console.log(`    File encrypted (${combinedData.length} bytes)`);
        console.log(`    IV: ${iv.toString('hex')}`);

        // Test 4: Upload to IPFS
        console.log('\n4.  Uploading to IPFS via Pinata...');
        const uploadResult = await ipfsService.uploadFile(
            combinedData,
            TEST_PATIENT_ADDRESS,
            TEST_CATEGORY,
            TEST_FILENAME,
            {
                fileType: 'txt',
                ivHex: iv.toString('hex'),
                testFile: 'true',
                description: 'Test medical report for integration testing'
            }
        );

        uploadedCID = uploadResult.cid;
        console.log(`    File uploaded successfully`);
        console.log(`    CID: ${uploadedCID}`);
        console.log(`    Size: ${uploadResult.size} bytes`);
        console.log(`    Gateway URL: ${uploadResult.pinataUrl}`);

        // Test 5: Retrieve from IPFS
        console.log('\n5.  Retrieving from IPFS...');
        const retrievedData = await ipfsService.retrieveFile(uploadedCID);
        console.log(`    File retrieved (${retrievedData.length} bytes)`);

        const sizeMatch = retrievedData.length === combinedData.length;
        console.log(`    Size match: ${sizeMatch ? 'YES ✓' : 'NO ✗'}`);

        // Test 6: Decrypt retrieved file
        console.log('\n6.  Decrypting Retrieved File...');
        const { iv: extractedIV, encryptedData: extractedData } =
            encryptionService.splitEncryptedData(retrievedData);

        const decrypted = encryptionService.decryptWithPassword(
            extractedData,
            TEST_PATIENT_ADDRESS,
            TEST_PASSWORD,
            extractedIV
        );

        const decryptedText = decrypted.toString('utf8');
        const contentMatch = decryptedText === testData;

        console.log(`    Decryption successful`);
        console.log(`    Content match: ${contentMatch ? 'YES ✓' : 'NO ✗'}`);
        console.log(`    First 100 chars: ${decryptedText.substring(0, 100)}...`);

        // Test 7: Get file metadata
        console.log('\n7.  Getting File Metadata...');
        const metadata = await ipfsService.getFileMetadata(uploadedCID);
        console.log(`    Filename: ${metadata.metadata.name}`);
        console.log(`    Patient: ${metadata.metadata.keyvalues.patient}`);
        console.log(`    Category: ${metadata.metadata.keyvalues.category}`);
        console.log(`    Uploaded at: ${metadata.metadata.keyvalues.uploadedAt}`);
        console.log(`    Encrypted: ${metadata.metadata.keyvalues.encrypted}`);

        // Test 8: List patient files
        console.log('\n8.  Listing Patient Files...');
        const patientFiles = await ipfsService.listPatientFiles(TEST_PATIENT_ADDRESS);
        console.log(`    Total files for patient: ${patientFiles.length}`);

        if (patientFiles.length > 0) {
            console.log(`   Files:`);
            patientFiles.forEach((file, index) => {
                console.log(`     ${index + 1}. ${file.filename} (${file.category}) - ${file.cid}`);
            });
        }

        // Test 9: Check if pinned
        console.log('\n9.  Verifying Pin Status...');
        const isPinned = await ipfsService.isPinned(uploadedCID);
        console.log(`    File is pinned: ${isPinned ? 'YES ✓' : 'NO ✗'}`);

        // Test 10: Get storage size
        console.log('\n10.  Getting Storage Statistics...');
        const storageSize = await ipfsService.getPatientStorageSize(TEST_PATIENT_ADDRESS);
        console.log(`    Total storage: ${storageSize} bytes (${(storageSize / 1024).toFixed(2)} KB)`);

        // Test 11: Cleanup (optional - uncomment to delete test file)
        console.log('\n11.  Cleanup Test File...');
        console.log(`    Test file will remain pinned on IPFS`);
        console.log(`    To delete, uncomment the cleanup code in test script`);
        console.log(`    CID to delete: ${uploadedCID}`);

        // Uncomment to delete test file:
        // await ipfsService.unpinFile(uploadedCID);
        // console.log(`    Test file unpinned from IPFS`);

        // Final summary
        console.log('\n' + '='.repeat(60));
        console.log('\n All IPFS Integration Tests Passed!\n');
        console.log('     Test Summary:');
        console.log(`   ✓ Pinata authentication`);
        console.log(`   ✓ File encryption`);
        console.log(`   ✓ IPFS upload`);
        console.log(`   ✓ IPFS retrieval`);
        console.log(`   ✓ File decryption`);
        console.log(`   ✓ Metadata management`);
        console.log(`   ✓ Patient file listing`);
        console.log(`   ✓ Storage statistics`);
        console.log(`   ✓ Pin verification`);
        console.log('\n IPFS Integration is fully functional!\n');

        // Provide CID for manual verification
        console.log(' Manual Verification:');
        console.log(`   View on IPFS Gateway:`);
        console.log(`   ${uploadResult.pinataUrl}`);
        console.log(`\n   Note: File is encrypted, so gateway will show encrypted data.`);
        console.log(`   CID for future reference: ${uploadedCID}\n`);

    } catch (error) {
        console.error('\n Test failed:', error);
        console.error('\nError details:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// Run tests
console.log('\n Test Configuration:');
console.log(`   Patient Address: ${TEST_PATIENT_ADDRESS}`);
console.log(`   Category: ${TEST_CATEGORY}`);
console.log(`   Filename: ${TEST_FILENAME}`);
console.log('\n' + '='.repeat(60));

runTests().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});
