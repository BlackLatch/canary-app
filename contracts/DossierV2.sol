// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CanaryDossierV2
 * @dev Enhanced dossier contract with update capabilities
 * @notice Create dossiers, update them, and release encrypted data conditionally
 */
contract CanaryDossierV2 {
    
    // Events
    event DossierCreated(address indexed user, uint256 indexed dossierId, string name);
    event CheckInPerformed(address indexed user, uint256 indexed dossierId);
    event DossierPaused(address indexed user, uint256 indexed dossierId);
    event DossierResumed(address indexed user, uint256 indexed dossierId);
    event DossierReleased(address indexed user, uint256 indexed dossierId);
    event DossierPermanentlyDisabled(address indexed user, uint256 indexed dossierId);
    event CheckInIntervalUpdated(address indexed user, uint256 indexed dossierId, uint256 newInterval);
    event FileHashAdded(address indexed user, uint256 indexed dossierId, string fileHash);
    event RecipientAdded(address indexed user, uint256 indexed dossierId, address recipient);
    event RecipientRemoved(address indexed user, uint256 indexed dossierId, address recipient);
    
    // Structs
    struct Dossier {
        uint256 id;
        string name;
        string description;
        bool isActive;
        bool isPermanentlyDisabled;
        bool isReleased;
        uint256 checkInInterval;
        uint256 lastCheckIn;
        string[] encryptedFileHashes;
        address[] recipients;
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
    
    modifier dossierEditable(address _user, uint256 _dossierId) {
        require(!dossiers[_user][_dossierId].isPermanentlyDisabled, "Dossier permanently disabled");
        require(!dossiers[_user][_dossierId].isReleased, "Dossier already released");
        require(dossiers[_user][_dossierId].isActive, "Dossier must be active to edit");
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
     * @dev Update check-in interval for a dossier
     * @notice Can only be done on active dossiers that haven't been released or disabled
     */
    function updateCheckInInterval(uint256 _dossierId, uint256 _newInterval) 
        external 
        validDossier(msg.sender, _dossierId)
        dossierEditable(msg.sender, _dossierId)
    {
        require(
            _newInterval >= MIN_CHECK_IN_INTERVAL && 
            _newInterval <= MAX_CHECK_IN_INTERVAL,
            "Invalid check-in interval"
        );
        
        dossiers[msg.sender][_dossierId].checkInInterval = _newInterval;
        emit CheckInIntervalUpdated(msg.sender, _dossierId, _newInterval);
    }
    
    /**
     * @dev Add an encrypted file hash to an existing dossier
     * @notice Can only add files to active dossiers
     */
    function addFileHash(uint256 _dossierId, string memory _fileHash) 
        external 
        validDossier(msg.sender, _dossierId)
        dossierEditable(msg.sender, _dossierId)
    {
        require(
            dossiers[msg.sender][_dossierId].encryptedFileHashes.length < MAX_FILES_PER_DOSSIER,
            "Max files per dossier reached"
        );
        require(bytes(_fileHash).length > 0, "File hash cannot be empty");
        
        dossiers[msg.sender][_dossierId].encryptedFileHashes.push(_fileHash);
        emit FileHashAdded(msg.sender, _dossierId, _fileHash);
    }
    
    /**
     * @dev Add multiple encrypted file hashes to an existing dossier
     * @notice Batch operation for adding multiple files at once
     */
    function addMultipleFileHashes(uint256 _dossierId, string[] memory _fileHashes) 
        external 
        validDossier(msg.sender, _dossierId)
        dossierEditable(msg.sender, _dossierId)
    {
        uint256 currentFileCount = dossiers[msg.sender][_dossierId].encryptedFileHashes.length;
        require(
            currentFileCount + _fileHashes.length <= MAX_FILES_PER_DOSSIER,
            "Would exceed max files per dossier"
        );
        
        for (uint256 i = 0; i < _fileHashes.length; i++) {
            require(bytes(_fileHashes[i]).length > 0, "File hash cannot be empty");
            dossiers[msg.sender][_dossierId].encryptedFileHashes.push(_fileHashes[i]);
            emit FileHashAdded(msg.sender, _dossierId, _fileHashes[i]);
        }
    }
    
    /**
     * @dev Add a recipient to an existing dossier
     */
    function addRecipient(uint256 _dossierId, address _recipient) 
        external 
        validDossier(msg.sender, _dossierId)
        dossierEditable(msg.sender, _dossierId)
    {
        require(
            dossiers[msg.sender][_dossierId].recipients.length < MAX_RECIPIENTS_PER_DOSSIER,
            "Max recipients reached"
        );
        require(_recipient != address(0), "Invalid recipient address");
        
        // Check if recipient already exists
        address[] memory currentRecipients = dossiers[msg.sender][_dossierId].recipients;
        for (uint256 i = 0; i < currentRecipients.length; i++) {
            require(currentRecipients[i] != _recipient, "Recipient already exists");
        }
        
        dossiers[msg.sender][_dossierId].recipients.push(_recipient);
        emit RecipientAdded(msg.sender, _dossierId, _recipient);
    }
    
    /**
     * @dev Remove a recipient from a dossier
     */
    function removeRecipient(uint256 _dossierId, address _recipient) 
        external 
        validDossier(msg.sender, _dossierId)
        dossierEditable(msg.sender, _dossierId)
    {
        address[] storage recipients = dossiers[msg.sender][_dossierId].recipients;
        require(recipients.length > 1, "Cannot remove last recipient");
        
        bool found = false;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == _recipient) {
                // Move the last element to this position and pop
                recipients[i] = recipients[recipients.length - 1];
                recipients.pop();
                found = true;
                break;
            }
        }
        
        require(found, "Recipient not found");
        emit RecipientRemoved(msg.sender, _dossierId, _recipient);
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
            if (dossiers[msg.sender][dossierId].isActive && 
                !dossiers[msg.sender][dossierId].isPermanentlyDisabled &&
                !dossiers[msg.sender][dossierId].isReleased) {
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
        
        if (dossier.isPermanentlyDisabled) {
            return true;
        }
        
        if (dossier.isReleased) {
            return false;
        }
        
        if (!dossier.isActive) {
            return true;
        }
        
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
     * @dev Release dossier data immediately
     */
    function releaseNow(uint256 _dossierId) external validDossier(msg.sender, _dossierId) {
        require(!dossiers[msg.sender][_dossierId].isPermanentlyDisabled, "Dossier already permanently disabled");
        require(!dossiers[msg.sender][_dossierId].isReleased, "Dossier already released");
        
        dossiers[msg.sender][_dossierId].isReleased = true;
        dossiers[msg.sender][_dossierId].isActive = false;
        
        emit DossierReleased(msg.sender, _dossierId);
    }
    
    /**
     * @dev Permanently disable a dossier
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