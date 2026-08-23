(() => {
  const root = document.documentElement;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const setTheme = (theme, persist = false) => {
    root.dataset.theme = theme;
    if (persist) {
      try { localStorage.setItem('portfolio-theme', theme); } catch (_) {}
    }
    if (themeMeta) themeMeta.content = theme === 'dark' ? '#0f1115' : '#fcf5eb';
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      const dark = theme === 'dark';
      const icon = button.querySelector('img');
      if (icon) icon.src = dark
        ? 'https://api.iconify.design/lucide:sun.svg?color=%236f7785'
        : 'https://api.iconify.design/lucide:moon.svg?color=%236f7785';
      button.setAttribute('aria-label', dark ? 'Enable light mode' : 'Enable dark mode');
      button.dataset.label = dark ? 'Light mode' : 'Dark mode';
    }
  };

  let savedTheme = null;
  try { savedTheme = localStorage.getItem('portfolio-theme'); } catch (_) {}
  setTheme(savedTheme || (systemTheme.matches ? 'dark' : 'light'));

  const dock = document.querySelector('.dock');
  if (dock) {
    const dockItems = {
      '/': { label: 'Home', icon: 'https://api.iconify.design/lucide:house.svg?color=%236f7785' },
      '/work/': { label: 'Experience', icon: 'https://api.iconify.design/lucide:briefcase-business.svg?color=%236f7785' },
      '/projects/': { label: 'Open source', icon: 'https://api.iconify.design/lucide:git-pull-request.svg?color=%236f7785' },
      '/about/': { label: 'About', icon: 'https://api.iconify.design/lucide:user-round.svg?color=%236f7785' }
    };

    dock.querySelectorAll('a').forEach(link => {
      let label = link.getAttribute('aria-label');
      if (!label) {
        const item = dockItems[link.getAttribute('href')];
        if (item) {
          label = item.label;
          const itemIcon = document.createElement('img');
          itemIcon.src = item.icon;
          itemIcon.alt = '';
          link.replaceChildren(itemIcon);
        }
      }
      if (label) {
        link.dataset.label = label;
        link.setAttribute('aria-label', label);
      }
    });

    const button = document.createElement('button');
    const icon = document.createElement('img');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.dataset.themeToggle = '';
    icon.alt = '';
    button.append(icon);
    button.classList.add('theme-toggle-floating');
    document.body.append(button);
    setTheme(root.dataset.theme);
    button.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
  }

  systemTheme.addEventListener?.('change', event => {
    try {
      if (!localStorage.getItem('portfolio-theme')) setTheme(event.matches ? 'dark' : 'light');
    } catch (_) { setTheme(event.matches ? 'dark' : 'light'); }
  });

  const flickeringGrids = document.querySelectorAll('[data-flickering-grid]');
  flickeringGrids.forEach(canvas => {
    const context = canvas.getContext('2d');
    if (!context) return;

    const squareSize = Number(canvas.dataset.squareSize) || 3;
    const gridGap = Number(canvas.dataset.gridGap) || 6;
    const cellSize = squareSize + gridGap;
    const flickerChance = .16;
    const maxOpacity = .3;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let columns = 0;
    let rows = 0;
    let opacities = new Float32Array();
    let pixelRatio = 1;
    let frame = 0;
    let lastTime = 0;
    let visible = true;

    const drawGrid = () => {
      const width = canvas.width / pixelRatio;
      const height = canvas.height / pixelRatio;
      context.clearRect(0, 0, width, height);
      context.fillStyle = getComputedStyle(root).getPropertyValue('--ink').trim();
      for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < rows; row += 1) {
          context.globalAlpha = opacities[column * rows + row];
          context.fillRect(column * cellSize, row * cellSize, squareSize, squareSize);
        }
      }
      context.globalAlpha = 1;
    };

    const resizeGrid = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      columns = Math.floor(width / cellSize);
      rows = Math.floor(height / cellSize);
      opacities = new Float32Array(columns * rows);
      for (let index = 0; index < opacities.length; index += 1) {
        opacities[index] = Math.random() * maxOpacity;
      }
      drawGrid();
    };

    const animateGrid = time => {
      if (!visible || reducedMotion.matches) return;
      const elapsed = lastTime ? (time - lastTime) / 1000 : 0;
      lastTime = time;
      for (let index = 0; index < opacities.length; index += 1) {
        if (Math.random() < flickerChance * elapsed) {
          opacities[index] = Math.random() * maxOpacity;
        }
      }
      drawGrid();
      frame = requestAnimationFrame(animateGrid);
    };

    const restartGrid = () => {
      cancelAnimationFrame(frame);
      lastTime = 0;
      drawGrid();
      if (visible && !reducedMotion.matches) frame = requestAnimationFrame(animateGrid);
    };

    const resizeObserver = new ResizeObserver(() => {
      resizeGrid();
      restartGrid();
    });
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      restartGrid();
    }, { threshold: 0 });
    const themeObserver = new MutationObserver(drawGrid);

    resizeObserver.observe(canvas);
    visibilityObserver.observe(canvas);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    reducedMotion.addEventListener?.('change', restartGrid);
    resizeGrid();
    restartGrid();
  });

  const contributionCalendar = document.querySelector('[data-contribution-calendar]');
  const contributionTotal = document.querySelector('[data-contribution-total]');
  if (contributionCalendar) {
    fetch('https://github-contributions-api.jogruber.de/v4/vipi-n?y=last')
      .then(response => {
        if (!response.ok) throw new Error('Contribution data unavailable');
        return response.json();
      })
      .then(data => {
        const days = Array.isArray(data.contributions) ? data.contributions : [];
        if (!days.length) throw new Error('No contribution data');

        const weeks = [];
        let currentWeek = [];
        const firstDay = new Date(`${days[0].date}T00:00:00`).getDay();
        for (let i = 0; i < firstDay; i += 1) currentWeek.push(null);

        days.forEach(day => {
          const weekday = new Date(`${day.date}T00:00:00`).getDay();
          if (weekday === 0 && currentWeek.length) {
            while (currentWeek.length < 7) currentWeek.push(null);
            weeks.push(currentWeek);
            currentWeek = [];
          }
          currentWeek.push(day);
        });
        while (currentWeek.length < 7) currentWeek.push(null);
        weeks.push(currentWeek);

        const fragment = document.createDocumentFragment();
        weeks.forEach(week => {
          const column = document.createElement('div');
          column.className = 'contribution-week';
          week.forEach(day => {
            const cell = document.createElement('span');
            cell.className = 'contribution-day';
            if (!day) {
              cell.classList.add('is-empty');
            } else {
              const count = Number(day.count) || 0;
              const level = Math.min(4, Math.max(0, Number(day.level) || 0));
              cell.dataset.level = String(level);
              cell.title = `${count} contribution${count === 1 ? '' : 's'} on ${day.date}`;
            }
            column.append(cell);
          });
          fragment.append(column);
        });

        const total = days.reduce((sum, day) => sum + (Number(day.count) || 0), 0);
        contributionCalendar.replaceChildren(fragment);
        contributionCalendar.setAttribute('aria-busy', 'false');
        contributionCalendar.setAttribute('role', 'img');
        contributionCalendar.setAttribute('aria-label', `${total.toLocaleString()} GitHub contributions in the last year`);
        if (contributionTotal) contributionTotal.textContent = `${total.toLocaleString()} contributions`;
      })
      .catch(() => {
        contributionCalendar.setAttribute('aria-busy', 'false');
        contributionCalendar.classList.add('contribution-error');
        contributionCalendar.textContent = 'Contribution activity is available on GitHub.';
        if (contributionTotal) contributionTotal.textContent = 'View on GitHub';
      });
  }

  const activityLists = document.querySelectorAll('[data-github-activity]');
  if (activityLists.length) {
    const eventDetails = event => {
      const ref = event.payload?.ref ? String(event.payload.ref).replace('refs/heads/', '') : '';
      const details = {
        PushEvent: { verb: ref ? `Pushed to ${ref} in` : 'Pushed commits to', icon: 'git-commit-horizontal' },
        PullRequestEvent: { verb: `${event.payload?.action || 'Updated'} a pull request in`, icon: 'git-pull-request' },
        IssuesEvent: { verb: `${event.payload?.action || 'Updated'} an issue in`, icon: 'circle-dot' },
        IssueCommentEvent: { verb: 'Commented on an issue in', icon: 'message-circle' },
        CreateEvent: { verb: event.payload?.ref_type === 'repository' ? 'Created repository' : `Created ${event.payload?.ref_type || 'branch'}${ref ? ` ${ref}` : ''} in`, icon: 'git-branch-plus' },
        DeleteEvent: { verb: `Deleted ${event.payload?.ref_type || 'branch'}${ref ? ` ${ref}` : ''} from`, icon: 'git-branch-minus' },
        ForkEvent: { verb: 'Forked', icon: 'git-fork' },
        WatchEvent: { verb: 'Starred', icon: 'star' },
        ReleaseEvent: { verb: `${event.payload?.action || 'Published'} a release in`, icon: 'tag' }
      };
      return details[event.type] || { verb: 'Contributed to', icon: 'activity' };
    };

    fetch('https://api.github.com/users/vipi-n/events/public?per_page=12', {
      headers: { Accept: 'application/vnd.github+json' }
    })
      .then(response => {
        if (!response.ok) throw new Error('Recent activity unavailable');
        return response.json();
      })
      .then(events => {
        const recent = (Array.isArray(events) ? events : [])
          .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
          .slice(0, 5);
        if (!recent.length) throw new Error('No recent public activity');

        activityLists.forEach(list => {
          const fragment = document.createDocumentFragment();
          recent.forEach(event => {
            const detail = eventDetails(event);
            const item = document.createElement('article');
            item.className = 'activity-item';

            const marker = document.createElement('span');
            marker.className = 'activity-marker';
            const icon = document.createElement('img');
            icon.src = `https://api.iconify.design/lucide:${detail.icon}.svg?color=%236f7785`;
            icon.alt = '';
            marker.append(icon);

            const copy = document.createElement('div');
            copy.className = 'activity-copy';
            const summary = document.createElement('p');
            const verb = document.createElement('strong');
            verb.textContent = `${detail.verb} `;
            const repository = document.createElement('a');
            repository.href = `https://github.com/${event.repo.name}`;
            repository.target = '_blank';
            repository.rel = 'noreferrer';
            repository.textContent = event.repo.name;
            summary.append(verb, repository);
            copy.append(summary);

            const time = document.createElement('time');
            time.dateTime = event.created_at;
            time.textContent = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(event.created_at));

            item.append(marker, copy, time);
            fragment.append(item);
          });
          list.replaceChildren(fragment);
          list.setAttribute('aria-busy', 'false');
        });
      })
      .catch(() => {
        activityLists.forEach(list => {
          list.classList.add('activity-error');
          list.setAttribute('aria-busy', 'false');
          const fallback = document.createElement('p');
          fallback.className = 'activity-loading';
          fallback.textContent = 'Recent public activity is available on GitHub.';
          list.replaceChildren(fallback);
        });
      });
  }

  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const syncHeader = () => header?.classList.toggle('scrolled', scrollY > 8);
  syncHeader();
  addEventListener('scroll', syncHeader, { passive: true });
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    menuButton.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
    mobileMenu?.classList.toggle('hidden', open);
  });

  const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      reveal.unobserve(entry.target);
    }
  }), { threshold: .1 });
  document.querySelectorAll('.reveal').forEach(element => reveal.observe(element));
})();
