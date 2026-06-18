import { useEffect, useState } from "react";
import io from "socket.io-client";
import axios from "axios";
import "./App.css";

const socket = io("http://localhost:5000", {
  autoConnect: true,
  transports: ["websocket"],
});

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [joined, setJoined] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);

  const [selectedUser, setSelectedUser] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);

  const [showDashboard, setShowDashboard] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");

  const [image, setImage] = useState(null);

  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);

  const [newMember, setNewMember] = useState("");
  const [myProfilePic, setMyProfilePic] = useState("");

  const fetchAll = async () => {
    try {
      const userRes = await axios.get(
        "http://localhost:5000/users"
      );
      setUsers(userRes.data);

      const currentUser = userRes.data.find(
        (u) => u.username === username
      );

      if (currentUser?.profilePic) {
        setMyProfilePic(currentUser.profilePic);
      }

      const groupRes = await axios.get(
        `http://localhost:5000/groups/${username}`
      );
      setGroups(groupRes.data);

      if (selectedGroup) {
        const updatedGroup = groupRes.data.find(
          (g) => g._id === selectedGroup._id
        );
        if (updatedGroup) {
          setSelectedGroup(updatedGroup);
        }
      }

      const msgRes = await axios.get(
        "http://localhost:5000/messages"
      );
      setMessages(msgRes.data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    const savedUsername =
      sessionStorage.getItem("username");

    if (savedUsername) {
      setUsername(savedUsername);
      setJoined(true);
    }
  }, []);

  useEffect(() => {
    if (joined && username) {
      socket.emit(
        "join_chat",
        username.trim()
      );
    }
  }, [joined, username]);

  useEffect(() => {
    if (!joined) return;

    fetchAll();

    const interval = setInterval(fetchAll, 3000);

    return () => clearInterval(interval);
  }, [joined, username]);

  /* Seen system */
  useEffect(() => {
    if (!selectedUser) return;

    messages.forEach((msg) => {
      if (
        msg.sender?.trim() ===
          selectedUser.trim() &&
        msg.receiver?.trim() ===
          username.trim() &&
        msg.status === "delivered"
      ) {
        socket.emit(
          "mark_seen",
          msg._id
        );
      }
    });
  }, [messages, selectedUser, username]);

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on(
      "message_seen",
      (updatedMessage) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === updatedMessage._id
              ? updatedMessage
              : msg
          )
        );
      }
    );

    socket.on("online_users", (data) => {
      setOnlineUsers(
        data.map((user) =>
          user.trim()
        )
      );
    });

    socket.on("show_typing", (data) => {
      if (data.sender === selectedUser) {
        setTypingUser(data.sender);

        setTimeout(() => {
          setTypingUser("");
        }, 1500);
      }
    });

    return () => {
      socket.off("receive_message");
      socket.off("message_seen");
      socket.off("online_users");
      socket.off("show_typing");
    };
  }, [selectedUser]);

  const handleAuth = async () => {
    try {
      const endpoint = isLogin
        ? "login"
        : "signup";

      const res = await axios.post(
        `http://localhost:5000/${endpoint}`,
        {
          username,
          password,
        }
      );

      sessionStorage.setItem(
        "username",
        res.data.username
      );

      setUsername(res.data.username);
      setJoined(true);
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Something went wrong"
      );
    }
  };

  const uploadProfilePic = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("username", username);

    const res = await axios.put(
      "http://localhost:5000/upload-profile",
      formData
    );

    setMyProfilePic(res.data.profilePic);
  };

  const logout = () => {
    sessionStorage.removeItem("username");
    window.location.reload();
  };

  const toggleMember = (member) => {
    if (selectedMembers.includes(member)) {
      setSelectedMembers(
        selectedMembers.filter(
          (m) => m !== member
        )
      );
    } else {
      setSelectedMembers([
        ...selectedMembers,
        member,
      ]);
    }
  };

  const createGroup = async () => {
    await axios.post(
      "http://localhost:5000/create-group",
      {
        name: groupName,
        members: [username, ...selectedMembers],
        createdBy: username,
      }
    );

    setGroupName("");
    setSelectedMembers([]);
    setShowGroupModal(false);
    fetchAll();
  };

  const addMember = async () => {
    if (!newMember.trim()) return;

    await axios.put(
      "http://localhost:5000/groups/add-member",
      {
        groupId: selectedGroup._id,
        username: newMember.trim(),
      }
    );

    setNewMember("");
    fetchAll();
  };

  const removeMember = async (member) => {
    if (
      member === selectedGroup.createdBy
    ) {
      alert("Creator cannot be removed");
      return;
    }

    if (member === username) {
      alert("Use Leave Group instead");
      return;
    }

    const res = await axios.put(
      "http://localhost:5000/groups/remove-member",
      {
        groupId: selectedGroup._id,
        username: member,
      }
    );

    setSelectedGroup(res.data);
    fetchAll();
  };

  const leaveGroup = async () => {
    await axios.put(
      "http://localhost:5000/groups/leave",
      {
        groupId: selectedGroup._id,
        username,
      }
    );

    setSelectedGroup(null);
    setShowDashboard(false);
    fetchAll();
  };

  const sendMessage = async () => {
    if (
      (!message.trim() && !image) ||
      (!selectedUser && !selectedGroup)
    )
      return;

    let imageUrl = "";

    if (image) {
      const formData = new FormData();
      formData.append("image", image);

      const uploadRes = await axios.post(
        "http://localhost:5000/upload",
        formData
      );

      imageUrl = uploadRes.data.imageUrl;
    }

    socket.emit("send_message", {
      text: message,
      image: imageUrl,
      sender: username,
      receiver: selectedGroup
        ? selectedGroup.name
        : selectedUser,
      time: new Date().toLocaleTimeString(),
    });

    setMessage("");
    setImage(null);
  };

  if (!joined) {
    return (
      <div className="joinScreen">
        <div className="joinCard">
          <h1>Lumio</h1>

          <input
            placeholder="Username"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value)
            }
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          <button onClick={handleAuth}>
            {isLogin ? "Login" : "Signup"}
          </button>

          <p onClick={() => setIsLogin(!isLogin)}>
            {isLogin
              ? "Create account"
              : "Already have account?"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="logo">
  <img
    src="/logo.png"
    alt="Lumio"
    className="mainLogo"
  />
</div>

       <div className="profileUpload">
  <img
    src={
      myProfilePic ||
      `https://i.pravatar.cc/100?u=${username}`
    }
    className="myProfilePic"
    alt="profile"
  />

  <label className="changePhotoBtn">
    Change Photo
    <input
      type="file"
      hidden
      accept="image/*"
      onChange={(e) =>
        uploadProfilePic(
          e.target.files[0]
        )
      }
    />
  </label>
</div> 

        <div className="topButtons">
          <button
            className="logoutBtn"
            onClick={logout}
          >
            Logout
          </button>

          <button
            className="groupBtn"
            onClick={() =>
              setShowGroupModal(true)
            }
          >
            + Group
          </button>
        </div>

        {users
          .filter((u) => u.username !== username)
          .map((user) => (
            <div
              key={user._id}
              className="user"
              onClick={() => {
                setSelectedUser(user.username);
                setSelectedGroup(null);
              }}
            >
              <img
                src={
                  user.profilePic ||
                  `https://i.pravatar.cc/100?u=${user.username}`
                }
                className="avatar"
              />
              <span>{user.username}</span>

              <span
                className={
                  onlineUsers.includes(
                    user.username.trim()
                  )
                    ? "onlineDot"
                    : "offlineDot"
                }
              ></span>
            </div>
          ))}

        <h2>Groups</h2>

        {groups.map((group) => (
          <div
            key={group._id}
            className="groupItem"
            onClick={() => {
              setSelectedGroup(group);
              setSelectedUser("");
            }}
          >
            #{group.name}
          </div>
        ))}
      </div>

      <div className="chatContainer">
        <div className="chatHeader">
          <h2>
            {selectedGroup
              ? selectedGroup.name
              : selectedUser ||
                "Select Chat"}
          </h2>

          {selectedGroup && (
            <button
              className="dashboardBtn"
              onClick={() =>
                setShowDashboard(true)
              }
            >
              Dashboard
            </button>
          )}
        </div>

        <div className="messages">
          {typingUser && (
            <p>{typingUser} is typing...</p>
          )}

          {messages
            .filter((msg) =>
              selectedGroup
                ? msg.receiver ===
                  selectedGroup.name
                : (msg.sender === username &&
                    msg.receiver ===
                      selectedUser) ||
                  (msg.sender ===
                    selectedUser &&
                    msg.receiver === username)
            )
            .map((msg, index) => (
              <div
                key={index}
                className="message"
              >
                <div>
                  <p>{msg.text}</p>

                  {msg.sender ===
                    username && (
                    <small>
                      {msg.status ===
                      "seen"
                        ? "✔✔ Seen"
                        : msg.status ===
                          "delivered"
                        ? "✔ Delivered"
                        : "⌛ Sent"}
                    </small>
                  )}
                </div>

                {msg.image && (
                  <img
                    src={msg.image}
                    className="chatImage"
                  />
                )}
              </div>
            ))}
        </div>

        <div className="inputArea">
  <div className="inputLogoSection">
    <img
      src="/logo.png"
      alt=""
      className="inputLogo"
    />

    <label className="fileBtn">
      📎 File
      <input
        type="file"
        hidden
        onChange={(e) =>
          setImage(e.target.files[0])
        }
      />
    </label>
  </div>

  <input
    value={message}
    placeholder="Type a message..."
    onChange={(e) => {
      setMessage(e.target.value);

      if (selectedUser) {
        socket.emit("typing", {
          sender: username,
          receiver: selectedUser.trim(),
        });
      }
    }}
  />

  <button onClick={sendMessage}>
    Send
  </button>
</div>
</div>

      {showDashboard &&
        selectedGroup && (
          <div className="dashboardModal">
            <div className="dashboardBox">
              <h2>{selectedGroup.name}</h2>

              <div className="dashboardMembers">
                {selectedGroup.members.map(
                  (member) => (
                    <div
                      key={member}
                      className="dashboardMember"
                    >
                      <span>{member}</span>

                      <button
                        className="memberActionBtn"
                        onClick={() =>
                          removeMember(
                            member
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  )
                )}
              </div>

              <div className="addMemberBox">
                <input
                  value={newMember}
                  onChange={(e) =>
                    setNewMember(
                      e.target.value
                    )
                  }
                  placeholder="Add member"
                />

                <button
                  className="addMemberBtn"
                  onClick={addMember}
                >
                  Add
                </button>
              </div>

              <button
                className="leaveGroupBtn"
                onClick={leaveGroup}
              >
                Leave Group
              </button>

              <button
                className="closeDashboardBtn"
                onClick={() =>
                  setShowDashboard(false)
                }
              >
                ✕ Close
              </button>
            </div>
          </div>
        )}

      {showGroupModal && (
        <div className="groupModal">
          <div className="groupBox">
            <h2>Create Group</h2>

            <input
              value={groupName}
              onChange={(e) =>
                setGroupName(
                  e.target.value
                )
              }
              placeholder="Group Name"
            />

            <div className="memberList">
              {users
                .filter(
                  (u) =>
                    u.username !==
                    username
                )
                .map((u) => (
                  <div
                    key={u._id}
                    className={
                      selectedMembers.includes(
                        u.username
                      )
                        ? "member activeMember"
                        : "member"
                    }
                    onClick={() =>
                      toggleMember(
                        u.username
                      )
                    }
                  >
                    {u.username}
                  </div>
                ))}
            </div>

            <button onClick={createGroup}>
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}