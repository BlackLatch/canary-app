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
    event DossierPaused(address indexed user, uint256 indexed dossierId);
    event DossierResumed(address indexed user, uint256 indexed dossierId);
    event DossierReleased(address indexed user, uint256 indexed dossierId);
    event DossierPermanentlyDisabled(address indexed user, uint256 indexed dossierId);
    
    // Structs
    struct Dossier {
        uint256 id;
        string name;
        string description; // Optional description of the dossier
        bool isActive; // false when paused
        bool isPermanentlyDisabled; // Once set to true, cannot be reversed
        bool isReleased; // Once set to true, data is permanently released
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
        string memory _description,
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
            description: _description,
            isActive: true,
            isPermanentlyDisabled: false,
            isReleased: false,
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
        require(!dossiers[msg.sender][_dossierId].isReleased, "Dossier already released");
        require(dossiers[msg.sender][_dossierId].isActive, "Dossier is paused");
        
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
        
        // If permanently disabled, data stays encrypted forever
        if (dossier.isPermanentlyDisabled) {
            return true;
        }
        
        // If released, data is decrypted
        if (dossier.isReleased) {
            return false;
        }
        
        // If paused, data stays encrypted but doesn't require check-ins
        if (!dossier.isActive) {
            return true; // Keep encrypted when paused
        }
        
        // Active dossier - check if within check-in window
        uint256 timeSinceLastCheckIn = block.timestamp - dossier.lastCheckIn;
        return timeSinceLastCheckIn <= (dossier.checkInInterval + GRACE_PERIOD);
    }
    
    /**
     * @dev Pause a dossier (temporarily stops check-in requirements)
     */
    function pauseDossier(uint256 _dossierId) external validDossier(msg.sender, _dossierId) {
        require(!dossiers[msg.sender][_dossierId].isPermanentlyDisabled, "Dossier permanently disabled");
        require(!dossiers[msg.sender][_dossierId].isReleased, "Dossier already released");
        require(dossiers[msg.sender][_dossierId].isActive, "Dossier already paused");
        
        dossiers[msg.sender][_dossierId].isActive = false;
        emit DossierPaused(msg.sender, _dossierId);
    }
    
    /**
     * @dev Resume a paused dossier
     */
    function resumeDossier(uint256 _dossierId) external validDossier(msg.sender, _dossierId) {
        require(!dossiers[msg.sender][_dossierId].isPermanentlyDisabled, "Cannot resume permanently disabled dossier");
        require(!dossiers[msg.sender][_dossierId].isReleased, "Cannot resume released dossier");
        require(!dossiers[msg.sender][_dossierId].isActive, "Dossier already active");
        
        dossiers[msg.sender][_dossierId].isActive = true;
        dossiers[msg.sender][_dossierId].lastCheckIn = block.timestamp;
        emit DossierResumed(msg.sender, _dossierId);
    }
    
    /**
     * @dev Release dossier data immediately (irreversible - releases data now)
     * @notice This action is permanent and releases the data immediately
     */
    function releaseNow(uint256 _dossierId) external validDossier(msg.sender, _dossierId) {
        require(!dossiers[msg.sender][_dossierId].isPermanentlyDisabled, "Dossier already permanently disabled");
        require(!dossiers[msg.sender][_dossierId].isReleased, "Dossier already released");
        
        dossiers[msg.sender][_dossierId].isReleased = true;
        dossiers[msg.sender][_dossierId].isActive = false;
        
        emit DossierReleased(msg.sender, _dossierId);
    }
    
    /**
     * @dev Permanently disable a dossier (irreversible - data stays encrypted forever)
     * @notice This action is permanent and keeps the data encrypted forever. No one can decrypt it.
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

