import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category } from '@/types';
import { CATEGORIES, CATEGORY_META } from '@/types';
import { useApp } from '@/store/AppStore';
import { useToast } from '@/components/ui';
import { Avatar, Button, CategoryIcon, CategoryTag, EmptyState, PageHead } from '@/components/ui';
import { ArrowRight, Bookmark, BookmarkCheck, Heart, Info, MapPin, Sparkles } from '@/components/ui/icons';
import { fromNowLabel } from '@/lib/date';
import { cx } from '@/lib/format';
import styles from './CityFeed.module.css';

/**
 * 同城（交互规格 §2.3 / HOP-015）
 *
 * - 内容流读取 state.posts，作者 / 关联活动都通过 store 查询，不直接读 localStorage；
 * - 点赞、收藏走 toggleInteraction，可撤销；store 会写回本地持久化，刷新后保留；
 * - 排序（最新 / 最热）与分类筛选都是对真实数据重排，不是装饰控件。
 */

type SortMode = 'latest' | 'hot';

export default function CityFeedPage() {
  const { state, currentUser, now, userById, activityById, toggleInteraction } = useApp();
  const toast = useToast();
  const [sort, setSort] = useState<SortMode>('latest');
  const [category, setCategory] = useState<Category | 'all'>('all');

  const posts = state.posts;

  const hasInteraction = (postId: string, action: 'like' | 'save') =>
    state.interactions.some(
      (interaction) =>
        interaction.userId === currentUser.id &&
        interaction.targetType === 'post' &&
        interaction.targetId === postId &&
        interaction.actionType === action,
    );

  /** 只展示内容里真实出现过的分类，避免出现点了必然为空的筛选项 */
  const usedCategories = useMemo(() => {
    const present = new Set<Category>();
    for (const post of posts) present.add(post.category);
    return CATEGORIES.filter((key) => present.has(key));
  }, [posts]);

  const visiblePosts = useMemo(() => {
    const list = category === 'all' ? posts : posts.filter((post) => post.category === category);
    return [...list].sort((a, b) => {
      if (sort === 'hot') {
        const diff = b.likeCount - a.likeCount;
        if (diff !== 0) return diff;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [posts, category, sort]);

  const toggleLike = (postId: string) => {
    toggleInteraction('post', postId, 'like');
  };

  const toggleSave = (postId: string, saved: boolean) => {
    toggleInteraction('post', postId, 'save');
    toast.success(saved ? '已取消收藏' : '已收藏 · 保存在本地，刷新后仍保留');
  };

  const resetCategory = () => setCategory('all');

  return (
    <div className={cx('page', styles.page)}>
      <PageHead
        title="同城"
        sub="武汉的城市内容与地点灵感：看看别人怎么过周末，再决定下一场去哪。"
        actions={
          <Button
            variant="secondary"
            to="/buddy"
            iconLeft={<Sparkles size={16} aria-hidden="true" />}
          >
            去找搭子
          </Button>
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.toolbarRow}>
          <div className="seg" role="group" aria-label="内容排序">
            <button
              type="button"
              className={cx('seg__item', sort === 'latest' && 'is-active')}
              aria-pressed={sort === 'latest'}
              onClick={() => setSort('latest')}
            >
              最新
            </button>
            <button
              type="button"
              className={cx('seg__item', sort === 'hot' && 'is-active')}
              aria-pressed={sort === 'hot'}
              onClick={() => setSort('hot')}
            >
              最热
            </button>
          </div>
          <span className={styles.toolbarHint} role="status" aria-live="polite">
            共 {visiblePosts.length} 条 · {sort === 'latest' ? '最新优先' : '按点赞数排序'}
          </span>
        </div>

        <div className={styles.categoryChips} role="group" aria-label="按分类筛选同城内容">
          <button
            type="button"
            className="chip"
            aria-pressed={category === 'all'}
            onClick={resetCategory}
          >
            全部
          </button>
          {usedCategories.map((key) => (
            <button
              key={key}
              type="button"
              className="chip"
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              {CATEGORY_META[key].label}
            </button>
          ))}
        </div>
      </div>

      {visiblePosts.length === 0 ? (
        <EmptyState
          icon={<MapPin size={22} aria-hidden="true" />}
          title={category === 'all' ? '同城还没有内容' : '这个分类还没有同城内容'}
          description={
            category === 'all'
              ? '先去找搭子看看正在招募的活动，参加完之后再回来分享。'
              : '换一个分类，或者查看全部内容。'
          }
          action={
            <div className={styles.emptyActions}>
              {category !== 'all' && (
                <Button variant="primary" onClick={resetCategory}>
                  查看全部内容
                </Button>
              )}
              <Button variant="secondary" to="/buddy">
                去找搭子
              </Button>
            </div>
          }
        />
      ) : (
        <div className={styles.feedGrid}>
          {visiblePosts.map((post) => {
            const author = userById(post.userId);
            const related = post.activityId ? activityById(post.activityId) : undefined;
            const liked = hasInteraction(post.id, 'like');
            const saved = hasInteraction(post.id, 'save');
            const meta = CATEGORY_META[post.category];
            return (
              <article key={post.id} className={cx('card', styles.post)}>
                <div className={styles.postArt} style={{ background: meta.gradient }} aria-hidden="true">
                  <span className={styles.postArtIcon}>
                    <CategoryIcon category={post.category} size={34} />
                  </span>
                  <span className={styles.postPlace}>
                    <MapPin size={12} aria-hidden="true" />
                    {post.location}
                  </span>
                </div>

                <div className={styles.postBody}>
                  <div className={styles.postTags}>
                    <CategoryTag category={post.category} />
                    <span className="tag tag--outline">
                      {fromNowLabel(post.createdAt, now)}
                    </span>
                  </div>
                  <h2 className={styles.postTitle}>{post.title}</h2>
                  <p className={styles.postContent}>{post.content}</p>

                  {related && (
                    <Link to={`/activity/${related.id}`} className={styles.relatedLink}>
                      <span className={styles.relatedText}>
                        <span className={styles.relatedLabel}>相关活动</span>
                        <span className={styles.relatedTitle}>{related.title}</span>
                      </span>
                      <span className={styles.relatedCta}>
                        查看相关活动
                        <ArrowRight size={13} aria-hidden="true" />
                      </span>
                    </Link>
                  )}

                  <div className={styles.postFoot}>
                    <div className={styles.author}>
                      <Avatar user={author} size="sm" />
                      <div className={styles.authorText}>
                        <span className={styles.authorName}>{author?.nickname ?? '演示用户'}</span>
                        <span className={styles.authorMeta}>{post.location}</span>
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={cx(styles.action, liked && styles.actionOn)}
                        aria-pressed={liked}
                        aria-label={liked ? '取消点赞' : '点赞'}
                        onClick={() => toggleLike(post.id)}
                      >
                        <Heart size={16} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
                        {post.likeCount}
                      </button>
                      <button
                        type="button"
                        className={cx(styles.action, saved && styles.actionOn)}
                        aria-pressed={saved}
                        aria-label={saved ? '取消收藏' : '收藏'}
                        onClick={() => toggleSave(post.id, saved)}
                      >
                        {saved ? (
                          <BookmarkCheck size={16} aria-hidden="true" />
                        ) : (
                          <Bookmark size={16} aria-hidden="true" />
                        )}
                        {saved ? '已收藏' : '收藏'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className={styles.demoNote}>
        <Info size={14} aria-hidden="true" />
        演示数据 · 本地模拟：内容、作者与点赞数均为虚构数据；点赞和收藏保存在浏览器本地，可随时撤销，刷新后仍会保留。
      </p>
    </div>
  );
}
