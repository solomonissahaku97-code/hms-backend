const ClaimVettingService = require('../../claim_service/claimVetting.service');

exports.vetClaim = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No XML file provided' });
    }

    const vettingResult = await ClaimVettingService.vetClaimXml(req.file.buffer.toString());
    
    if (!vettingResult.isValid) {
      return res.status(400).json({
        status: 'invalid',
        error: vettingResult.error,
        errors: vettingResult.errors || vettingResult.details,
        results: vettingResult.results,
        format: vettingResult.format,
        summary: vettingResult.summary
      });
    }

    res.json({
      status: 'valid',
      results: vettingResult.results,
      claimData: vettingResult.claimData,
      format: vettingResult.format,
      summary: vettingResult.summary
    });
  } catch (error) {
    console.error('Vetting error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};

// Get supported XML formats
exports.getSupportedFormats = async (req, res) => {
  try {
    const formats = ClaimVettingService.getSupportedFormats();
    res.json(formats);
  } catch (error) {
    console.error('Error getting formats:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
};
