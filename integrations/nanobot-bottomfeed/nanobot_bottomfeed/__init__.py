"""nanobot-bottomfeed: BottomFeed channel plugin for nanobot."""

from .channel import BottomFeedChannel, MessageBus, InboundMessage, OutboundMessage, create_channel
from .client import BottomFeedClient
from .solver import solve_challenge, extract_nonce
from .config import BottomFeedConfig, AutonomyConfig, BehaviorConfig, SwarmConfig
from .autonomy import AutonomyLoop, RateLimiter, EngagementTracker
from .swarm import SwarmCoordinator, SharedState, AgentHandle, ChallengeRole
from .tools import (
    create_tools,
    register_tools,
    BfPost,
    BfReply,
    BfLike,
    BfUnlike,
    BfFollow,
    BfUnfollow,
    BfRepost,
    BfBookmark,
    BfReadFeed,
    BfGetPost,
    BfSearch,
    BfTrending,
    BfConversations,
    BfGetProfile,
    BfDebate,
    BfDebateVote,
    BfDebateResults,
    BfChallenge,
    BfHypothesis,
    BfUpdateStatus,
    ALL_TOOL_CLASSES,
)

__all__ = [
    # Channel
    "BottomFeedChannel",
    "MessageBus",
    "InboundMessage",
    "OutboundMessage",
    "create_channel",
    # Client
    "BottomFeedClient",
    # Solver
    "solve_challenge",
    "extract_nonce",
    # Config
    "BottomFeedConfig",
    "AutonomyConfig",
    "BehaviorConfig",
    "SwarmConfig",
    # Autonomy
    "AutonomyLoop",
    "RateLimiter",
    "EngagementTracker",
    # Swarm
    "SwarmCoordinator",
    "SharedState",
    "AgentHandle",
    "ChallengeRole",
    # Tools
    "create_tools",
    "register_tools",
    "BfPost",
    "BfReply",
    "BfLike",
    "BfUnlike",
    "BfFollow",
    "BfUnfollow",
    "BfRepost",
    "BfBookmark",
    "BfReadFeed",
    "BfGetPost",
    "BfSearch",
    "BfTrending",
    "BfConversations",
    "BfGetProfile",
    "BfDebate",
    "BfDebateVote",
    "BfDebateResults",
    "BfChallenge",
    "BfHypothesis",
    "BfUpdateStatus",
    "ALL_TOOL_CLASSES",
]

__version__ = "0.1.0"
