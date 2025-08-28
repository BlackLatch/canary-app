// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CanaryDossier
 * @dev Simple dossier-based truth protection platform
 * @notice Create dossiers, check in, and release encrypted data conditionally
 */
contract CanaryDossier {
    
    // Events
    event DossierCreated(address indexed user, uint256 indexed dossierId, string name);
    event CheckInPerformed(address indexed user, uint256 indexed dossierId);
    event DossierTriggered(address indexed user, uint256 indexed dossierId);
    event DossierPermanentlyDisabled(address indexed user, uint256 indexed dossierId);
    
    // Structs
    struct Dossier {
        uint256 id;
        string name;
        bool isActive;
        bool isPermanentlyDisabled; // Once set to true, cannot be reversed
        uint256 checkInInterval; // in seconds
        uint256 lastCheckIn;
        string[] encryptedFileHashes; // IPFS hashes for encrypted files
        address[] recipients; // ETH addresses who can decrypt
    }
    
    // State variables
    mapping(address => mapping(uint256 => Dossier)) public dossiers;
    mapping(address => uint256[]) public userDossierIds;
    mapping(address => uint256) public userDossierCount;
    
    // Constants
    uint256 public constant MIN_CHECK_IN_INTERVAL = 1 hours;
    uint256 public constant MAX_CHECK_IN_INTERVAL = 30 days;
    uint256 public constant GRACE_PERIOD = 1 hours;
    uint256 public constant MAX_DOSSIERS_PER_USER = 50;
    uint256 public constant MAX_RECIPIENTS_PER_DOSSIER = 20;
    uint256 public constant MAX_FILES_PER_DOSSIER = 100;
    
    // Modifiers
    modifier validDossier(address _user, uint256 _dossierId) {
        require(dossiers[_user][_dossierId].id == _dossierId, "Dossier does not exist");
        _;
    }
    
    /**
     * @dev Create a new dossier
     */
    function createDossier(
        string memory _name,
        uint256 _checkInInterval,
        address[] memory _recipients,
        string[] memory _encryptedFileHashes
    ) external returns (uint256 dossierId) {
        require(
            _checkInInterval >= MIN_CHECK_IN_INTERVAL && 
            _checkInInterval <= MAX_CHECK_IN_INTERVAL,
            "Invalid check-in interval"
        );
        require(userDossierCount[msg.sender] < MAX_DOSSIERS_PER_USER, "Max dossiers reached");
        require(_recipients.length > 0 && _recipients.length <= MAX_RECIPIENTS_PER_DOSSIER, "Invalid recipients");
        require(_encryptedFileHashes.length > 0 && _encryptedFileHashes.length <= MAX_FILES_PER_DOSSIER, "Invalid files");
        
        dossierId = userDossierCount[msg.sender];
        
        dossiers[msg.sender][dossierId] = Dossier({
            id: dossierId,
            name: _name,
            isActive: true,
            isPermanentlyDisabled: false,
            checkInInterval: _checkInInterval,
            lastCheckIn: block.timestamp,
            encryptedFileHashes: _encryptedFileHashes,
            recipients: _recipients
        });
        
        userDossierIds[msg.sender].push(dossierId);
        userDossierCount[msg.sender]++;
        
        emit DossierCreated(msg.sender, dossierId, _name);
    }
    
    /**
     * @dev Check-in for a specific dossier
     */
    function checkIn(uint256 _dossierId) external validDossier(msg.sender, _dossierId) {
        require(!dossiers[msg.sender][_dossierId].isPermanentlyDisabled, "Dossier permanently disabled");
        require(dossiers[msg.sender][_dossierId].isActive, "Dossier not active");
        
        dossiers[msg.sender][_dossierId].lastCheckIn = block.timestamp;
        emit CheckInPerformed(msg.sender, _dossierId);
    }
    
    /**
     * @dev Check-in for all active dossiers
     */
    function checkInAll() external {
        uint256[] memory userDossiers = userDossierIds[msg.sender];
        require(userDossiers.length > 0, "No dossiers found");
        
        for (uint256 i = 0; i < userDossiers.length; i++) {
            uint256 dossierId = userDossiers[i];
            if (dossiers[msg.sender][dossierId].isActive && !dossiers[msg.sender][dossierId].isPermanentlyDisabled) {
                dossiers[msg.sender][dossierId].lastCheckIn = block.timestamp;
                emit CheckInPerformed(msg.sender, dossierId);
            }
        }
    }
    
    /**
     * @dev Check if dossier should stay encrypted (for TACo integration)
     */
    function shouldDossierStayEncrypted(address _user, uint256 _dossierId) 
        external 
        view 
        validDossier(_user, _dossierId)
        returns (bool) 
    {
        Dossier memory dossier = dossiers[_user][_dossierId];
        
        // If permanently disabled, never stay encrypted
        if (dossier.isPermanentlyDisabled) {
            return false;
        }
        
        if (!dossier.isActive) {
            return false;
        }
        
        uint256 timeSinceLastCheckIn = block.timestamp - dossier.lastCheckIn;
        return timeSinceLastCheckIn <= (dossier.checkInInterval + GRACE_PERIOD);
    }
    
    /**
     * @dev Deactivate a dossier (releases data)
     */
    function deactivateDossier(uint256 _dossierId) external validDossier(msg.sender, _dossierId) {
        require(!dossiers[msg.sender][_dossierId].isPermanentlyDisabled, "Dossier permanently disabled");
        dossiers[msg.sender][_dossierId].isActive = false;
        emit DossierTriggered(msg.sender, _dossierId);
    }
    
    /**
     * @dev Reactivate a dossier
     */
    function reactivateDossier(uint256 _dossierId) external validDossier(msg.sender, _dossierId) {
        require(!dossiers[msg.sender][_dossierId].isPermanentlyDisabled, "Cannot reactivate permanently disabled dossier");
        dossiers[msg.sender][_dossierId].isActive = true;
        dossiers[msg.sender][_dossierId].lastCheckIn = block.timestamp;
    }
    
    /**
     * @dev Permanently disable a dossier (irreversible - releases data permanently)
     * @notice This action is permanent and cannot be undone
     */
    function permanentlyDisableDossier(uint256 _dossierId) external validDossier(msg.sender, _dossierId) {
        require(!dossiers[msg.sender][_dossierId].isPermanentlyDisabled, "Dossier already permanently disabled");
        
        dossiers[msg.sender][_dossierId].isPermanentlyDisabled = true;
        dossiers[msg.sender][_dossierId].isActive = false;
        
        emit DossierPermanentlyDisabled(msg.sender, _dossierId);
    }
    
    /**
     * @dev Get dossier details
     */
    function getDossier(address _user, uint256 _dossierId) 
        external 
        view 
        validDossier(_user, _dossierId)
        returns (Dossier memory) 
    {
        return dossiers[_user][_dossierId];
    }
    
    /**
     * @dev Get user's dossier IDs
     */
    function getUserDossierIds(address _user) external view returns (uint256[] memory) {
        return userDossierIds[_user];
    }
    
    /**
     * @dev Check if user has any dossiers
     */
    function userExists(address _user) external view returns (bool) {
        return userDossierIds[_user].length > 0;
    }
}

