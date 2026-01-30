"use client";

import { faBars } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "~/helpers/authClient.ts";

function NavbarItems() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const [expanded, setExpanded] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [userExpanded, setUserExpanded] = useState(false);
  const [canAccessModDashboard, setCanAccessModDashboard] = useState(false);

  useEffect(() => {
    if (session?.user) {
      authClient.admin.hasPermission({ permissions: { modDashboard: ["view"] } }).then(({ data }) => {
        if (data) setCanAccessModDashboard(data.success);
      });
    }
  }, [session]);

  const logOut = async () => {
    collapseAll();
    await authClient.signOut();
    router.push("/");
  };

  const toggleDropdown = (dropdown: "results" | "user", newValue = !resultsExpanded) => {
    if (dropdown === "results") {
      setResultsExpanded(newValue);
      setUserExpanded(false);
    } else {
      setUserExpanded(newValue);
      setResultsExpanded(false);
    }
  };

  const collapseAll = () => {
    setExpanded(false);
    setResultsExpanded(false);
    setUserExpanded(false);
  };

  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary">
      <div className="container-md position-relative">
        <Link className="navbar-brand" href="/" prefetch={false}>
          <Image src="/favicon.png" height={45} width={45} alt="Home" />
        </Link>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="cc-icon-button d-lg-none"
          title="Menu"
          aria-label="Menu"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
        <div className={`navbar-collapse justify-content-end ${expanded ? "" : "collapse"}`}>
          <ul className="navbar-nav fs-5 mx-2 mt-3 mt-lg-0 gap-lg-4 align-items-lg-end align-items-start">
            <li className="nav-item">
              <Link
                className={`nav-link ${pathname === "/competitions" ? "active" : ""}`}
                prefetch={false}
                href="/competitions"
                onClick={collapseAll}
              >
                Contests
              </Link>
            </li>
            <li
              className="nav-item dropdown"
              onMouseEnter={() => toggleDropdown("results", true)}
              onMouseLeave={() => toggleDropdown("results", false)}
            >
              <button
                type="button"
                className={`nav-link dropdown-toggle ${/^\/(rankings|records)\//.test(pathname) ? "active" : ""}`}
                onClick={() => toggleDropdown("results")}
              >
                Results
              </button>
              <ul className={`dropdown-menu px-3 px-lg-2 py-0 ${resultsExpanded ? "show" : ""}`}>
                <li>
                  <Link
                    className={`nav-link ${/^\/records\//.test(pathname) ? "active" : ""}`}
                    href="/records"
                    prefetch={false}
                    onClick={collapseAll}
                  >
                    Records
                  </Link>
                </li>
                <li>
                  <Link
                    className={`nav-link ${/^\/rankings\//.test(pathname) ? "active" : ""}`}
                    href="/rankings"
                    prefetch={false}
                    onClick={collapseAll}
                  >
                    Rankings
                  </Link>
                </li>
              </ul>
            </li>
            <li className="nav-item">
              <Link
                className={`nav-link ${pathname === "/rules" ? "active" : ""}`}
                href="/rules"
                prefetch={false}
                onClick={collapseAll}
              >
                Rules
              </Link>
            </li>
            <li className="nav-item">
              <Link
                className={`nav-link ${pathname === "/about" ? "active" : ""}`}
                prefetch={false}
                href="/about"
                onClick={collapseAll}
              >
                About
              </Link>
            </li>
            {!session ? (
              <li className="nav-item">
                <Link className="nav-link" href="/login" prefetch={false} onClick={collapseAll}>
                  Log In
                </Link>
              </li>
            ) : (
              <li
                className="nav-item dropdown"
                onMouseEnter={() => toggleDropdown("user", true)}
                onMouseLeave={() => toggleDropdown("user", false)}
              >
                <button type="button" onClick={() => toggleDropdown("user")} className="nav-link dropdown-toggle">
                  {session.user.username}
                </button>
                <ul className={`dropdown-menu end-0 px-3 px-lg-2 py-0 ${userExpanded ? "show" : ""}`}>
                  {canAccessModDashboard && (
                    <li>
                      <Link className="nav-link" href="/mod" prefetch={false} onClick={collapseAll}>
                        Mod Dashboard
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link className="nav-link" href="/user/submit-results" prefetch={false} onClick={collapseAll}>
                      Submit Results
                    </Link>
                  </li>
                  <li>
                    <Link className="nav-link" href="/user/settings" prefetch={false} onClick={collapseAll}>
                      Settings
                    </Link>
                  </li>
                  <li>
                    <button type="button" onClick={logOut} className="nav-link">
                      Log Out
                    </button>
                  </li>
                </ul>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default NavbarItems;
